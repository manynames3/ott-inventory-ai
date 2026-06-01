from __future__ import annotations

from datetime import date
from typing import Dict, Optional

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.base import REQUIRED_COLUMNS
from app.adapters.csv_adapter import CSVImportAdapter
from app.auth import authenticate, create_access_token, require_user
from app.config import get_settings
from app.database import get_db
from app.models import Customer, Product
from app.services.dashboard import build_customer_detail, build_dashboard, build_sku_detail
from app.services.dataframes import load_core_dataframes, model_to_dataframe
from app.services.fefo import recommend_fefo, waste_risk_alerts
from app.services.forecasting import ForecastEngine
from app.services.jobs import refresh_recommendation_tables
from app.services.nl_query import answer_question
from app.services.raw_file_storage import RawFileStorage
from app.services.reorder import generate_reorder_recommendations
from app.services.templates import csv_template, next_questions, xlsx_template


settings = get_settings()

app = FastAPI(
    title="Inventory AI API",
    description="Expiration-aware inventory optimization and natural-language operations API.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str


class LoginRequest(BaseModel):
    username: str
    password: str


def _records(df: pd.DataFrame):
    if df.empty:
        return []
    safe = df.where(pd.notnull(df), None)
    rows = []
    for row in safe.to_dict("records"):
        rows.append(
            {
                key: value.isoformat() if hasattr(value, "isoformat") else value
                for key, value in row.items()
            }
        )
    return rows


@app.get("/health")
def health():
    return {"ok": True, "service": "inventory-ai-api"}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    if not settings.auth_enabled:
        return {
            "access_token": create_access_token("auth-disabled", settings=settings),
            "token_type": "bearer",
            "user": {"username": "auth-disabled"},
        }
    if not authenticate(request.username, request.password, settings=settings):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")
    return {
        "access_token": create_access_token(request.username, settings=settings),
        "token_type": "bearer",
        "user": {"username": request.username},
    }


@app.get("/api/auth/me")
def me(user: Dict[str, object] = Depends(require_user)):
    return {"user": {"username": user.get("sub")}}


@app.get("/api/import/requirements")
def import_requirements():
    return {
        "csv_required_columns": REQUIRED_COLUMNS,
        "supported_upload_formats": [".csv", ".xlsx", ".xlsm"],
        "template_formats": ["csv", "xlsx"],
        "raw_file_storage": {
            "service": "s3",
            "enabled": bool(settings.aws_s3_raw_import_bucket),
            "bucket_configured": bool(settings.aws_s3_raw_import_bucket),
            "prefix": settings.aws_s3_import_prefix,
        },
        "erp_adapters": {
            "sap": "placeholder only; see docs/erp_integration.md",
            "oracle": "placeholder only; see docs/erp_integration.md",
        },
    }


@app.get("/api/templates/{entity}.{file_format}")
def download_template(entity: str, file_format: str):
    if entity not in REQUIRED_COLUMNS:
        raise HTTPException(status_code=404, detail=f"Unsupported template entity '{entity}'.")
    normalized_format = file_format.lower()
    if normalized_format == "csv":
        return Response(
            content=csv_template(entity),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{entity}_template.csv"'},
        )
    if normalized_format == "xlsx":
        return Response(
            content=xlsx_template(entity),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{entity}_template.xlsx"'},
        )
    raise HTTPException(status_code=404, detail="Template format must be csv or xlsx.")


@app.post("/api/import/{entity}")
def import_csv(
    entity: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Dict[str, object] = Depends(require_user),
):
    adapter = CSVImportAdapter()
    content = file.file.read()
    stored = None
    storage_error = None
    try:
        stored = RawFileStorage(settings=settings).store(
            entity=entity,
            filename=file.filename or f"{entity}.csv",
            content=content,
            content_type=file.content_type,
        )
    except Exception as exc:
        storage_error = str(exc)

    result = adapter.load_file(entity, file.filename or f"{entity}.csv", content)
    if result.errors:
        raise HTTPException(
            status_code=400,
            detail={
                "entity": entity,
                "rows_seen": result.rows_seen,
                "errors": result.errors,
                "required_columns": REQUIRED_COLUMNS.get(entity, []),
            },
        )

    dataframe = getattr(result, "dataframe")
    db_result = adapter.import_dataframe(db, entity, dataframe)
    if db_result.errors:
        raise HTTPException(
            status_code=400,
            detail={
                "entity": entity,
                "rows_seen": db_result.rows_seen,
                "errors": db_result.errors,
                "required_columns": REQUIRED_COLUMNS.get(entity, []),
            },
        )
    refresh_counts = refresh_recommendation_tables(
        db,
        as_of=date.today(),
        lead_time_days=settings.supplier_lead_time_days,
    )
    return {
        "entity": entity,
        "rows_seen": db_result.rows_seen,
        "rows_imported": db_result.rows_imported,
        "raw_file_storage": {
            "enabled": bool(settings.aws_s3_raw_import_bucket),
            "stored": stored.__dict__ if stored else None,
            "error": storage_error,
        },
        "recommendation_refresh": refresh_counts,
        "next_questions": next_questions(entity),
        "message": f"Imported {db_result.rows_imported} {entity} rows.",
    }


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    return build_dashboard(db, lead_time_days=settings.supplier_lead_time_days)


@app.get("/api/products")
def list_products(limit: int = 100, db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    df = model_to_dataframe(db, Product)
    return {"rows": _records(df.head(limit)), "count": int(len(df))}


@app.get("/api/customers")
def list_customers(limit: int = 100, db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    df = model_to_dataframe(db, Customer)
    return {"rows": _records(df.head(limit)), "count": int(len(df))}


@app.get("/api/sku/{sku}")
def sku_detail(sku: str, db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    detail = build_sku_detail(db, sku=sku, lead_time_days=settings.supplier_lead_time_days)
    if detail["product"] is None:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found.")
    return detail


@app.get("/api/customers/{customer_id}")
def customer_detail(customer_id: str, db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    detail = build_customer_detail(db, customer_id=customer_id)
    if detail["customer"] is None:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
    return detail


@app.get("/api/fefo")
def fefo(
    db: Session = Depends(get_db),
    sku: Optional[str] = None,
    warehouse: Optional[str] = None,
    _: Dict[str, object] = Depends(require_user),
):
    data = load_core_dataframes(db)
    lots = data["inventory_lots"]
    if sku and not lots.empty:
        lots = lots[lots["sku"].astype(str) == sku]
    if warehouse and not lots.empty:
        lots = lots[lots["warehouse"].astype(str) == warehouse]
    return {"rows": recommend_fefo(lots, as_of=date.today()) if not lots.empty else []}


@app.get("/api/waste-risk-alerts")
def waste_risk(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    return {"rows": waste_risk_alerts(data["inventory_lots"], as_of=date.today(), horizon_days=90)}


@app.get("/api/forecasts")
def forecasts(db: Session = Depends(get_db), sku: Optional[str] = None, _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    products = data["products"]
    skus = [sku] if sku else (products["sku"].tolist() if not products.empty else [])
    engine = ForecastEngine()
    return {"rows": engine.forecast_all(data["orders"], skus, as_of=date.today())}


@app.get("/api/reorder-recommendations")
def reorder_recommendations(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    products = data["products"]
    return {
        "rows": generate_reorder_recommendations(
            inventory_lots=data["inventory_lots"],
            orders=data["orders"],
            inbound_shipments=data["inbound_shipments"],
            skus=products["sku"].tolist() if not products.empty else None,
            as_of=date.today(),
            lead_time_days=settings.supplier_lead_time_days,
        )
    }


@app.post("/api/query")
def query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    _: Dict[str, object] = Depends(require_user),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")
    return answer_question(db, request.question, lead_time_days=settings.supplier_lead_time_days)


@app.post("/api/jobs/recalculate")
def recalculate(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    counts = refresh_recommendation_tables(
        db,
        as_of=date.today(),
        lead_time_days=settings.supplier_lead_time_days,
    )
    return {"message": "Recommendation tables refreshed.", "counts": counts}


@app.post("/api/demo/seed-ottogi")
def seed_ottogi_demo(_: Dict[str, object] = Depends(require_user)):
    if not settings.allow_demo_seed:
        raise HTTPException(
            status_code=403,
            detail="Demo seeding is disabled. Set ALLOW_DEMO_SEED=true for a controlled demo environment.",
        )
    from app.seed_ottogi_demo import seed

    summary = seed()
    return {"message": "Ottogi-style demo dataset loaded.", "summary": summary}
