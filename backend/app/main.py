from __future__ import annotations

import json
import os
import time
from datetime import date, datetime, timezone
from typing import Dict, Optional

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.adapters.base import REQUIRED_COLUMNS
from app.adapters.csv_adapter import CSVImportAdapter
from app.auth import authenticate, can_approve_actions, create_access_token, require_user, role_for_user
from app.config import get_settings
from app.database import get_db
from app.models import ActionReview, Customer, Product
from app.services.dashboard import build_customer_detail, build_dashboard, build_sku_detail
from app.services.dataframes import load_core_dataframes, model_to_dataframe
from app.services.fefo import recommend_fefo, waste_risk_alerts
from app.services.forecasting import ForecastEngine
from app.services.ai_query import ai_status
from app.services.jobs import refresh_recommendation_tables
from app.services.nl_query import answer_question
from app.services.product_context import enrich_product_rows
from app.services.raw_file_storage import RawFileStorage
from app.services.reorder import generate_reorder_recommendations
from app.services.templates import csv_template, next_questions, xlsx_template
from app.services.validation import forecast_backtest


settings = get_settings()
MONITORING_EVENTS: list[Dict[str, object]] = []
AUDIT_EVENTS: list[Dict[str, object]] = []
SLOW_REQUEST_MS = 2_000
SLOW_JOB_MS = 10_000

app = FastAPI(
    title="StockSense AI API",
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


def _record_monitoring_event(
    event_type: str,
    severity: str,
    message: str,
    details: Optional[Dict[str, object]] = None,
) -> None:
    MONITORING_EVENTS.append(
        {
            "event_type": event_type,
            "severity": severity,
            "message": message,
            "details": details or {},
            "created_at_epoch": int(time.time()),
        }
    )
    del MONITORING_EVENTS[:-250]


def _record_audit_event(
    action: str,
    resource: str,
    user: str,
    details: Optional[Dict[str, object]] = None,
    request: Optional[Request] = None,
) -> None:
    AUDIT_EVENTS.append(
        {
            "action": action,
            "resource": resource,
            "user": user,
            "origin": request.headers.get("origin", "") if request else "",
            "source_ip": request.client.host if request and request.client else "",
            "details": details or {},
            "created_at_epoch": int(time.time()),
        }
    )
    del AUDIT_EVENTS[:-500]


@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _record_monitoring_event(
            "api_error",
            "critical",
            f"{request.method} {request.url.path} failed.",
            {"path": request.url.path, "method": request.method, "duration_ms": duration_ms, "error": type(exc).__name__},
        )
        raise
    duration_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-stocksense-duration-ms"] = str(duration_ms)
    if response.status_code >= 500:
        _record_monitoring_event(
            "api_error",
            "critical",
            f"{request.method} {request.url.path} returned HTTP {response.status_code}.",
            {"path": request.url.path, "method": request.method, "duration_ms": duration_ms, "status_code": response.status_code},
        )
    elif duration_ms >= SLOW_REQUEST_MS and request.url.path.startswith("/api/"):
        _record_monitoring_event(
            "slow_request",
            "warning",
            f"{request.method} {request.url.path} took {duration_ms} ms.",
            {"path": request.url.path, "method": request.method, "duration_ms": duration_ms},
        )
    return response


class QueryRequest(BaseModel):
    question: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ActionReviewRequest(BaseModel):
    action_key: str
    status: str
    note: str = ""
    action_snapshot: Dict[str, object] = Field(default_factory=dict)


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
    return {"ok": True, "service": "stocksense-api", "tenant_id": settings.tenant_id}


@app.post("/api/auth/login")
def login(login_request: LoginRequest, raw_request: Request):
    if not settings.auth_enabled:
        return {
            "access_token": create_access_token("auth-disabled", settings=settings),
            "token_type": "bearer",
            "user": {
                "username": "auth-disabled",
                "tenant_id": settings.tenant_id,
                "role": "admin",
                "can_approve_actions": True,
            },
        }
    if not authenticate(login_request.username, login_request.password, settings=settings):
        _record_audit_event(
            "login_failed",
            "auth",
            login_request.username or "unknown",
            {"username": login_request.username},
            raw_request,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")
    role = role_for_user(login_request.username, settings=settings)
    _record_audit_event("login_success", "auth", login_request.username, {}, raw_request)
    return {
        "access_token": create_access_token(login_request.username, settings=settings),
        "token_type": "bearer",
        "user": {
            "username": login_request.username,
            "tenant_id": settings.tenant_id,
            "role": role,
            "can_approve_actions": can_approve_actions({"role": role}),
        },
    }


@app.get("/api/auth/me")
def me(user: Dict[str, object] = Depends(require_user)):
    return {
        "user": {
            "username": user.get("sub"),
            "tenant_id": user.get("tenant_id", settings.tenant_id),
            "role": user.get("role", "planner"),
            "can_approve_actions": can_approve_actions(user),
        }
    }


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
        "scheduled_imports": {
            "enabled": False,
            "mode": "local_fastapi_manual_upload",
        },
        "auth": {
            "mode": "password",
            "cognito_ready": False,
        },
        "audit": {
            "immutable_archive_configured": bool(os.getenv("AWS_S3_AUDIT_ARCHIVE_BUCKET", "").strip()),
            "alerts_configured": bool(os.getenv("ALERT_SNS_TOPIC_ARN", "").strip()),
        },
        "retention": {
            "raw_upload_days": int(os.getenv("RAW_FILE_RETENTION_DAYS", "365")),
            "audit_event_days": int(os.getenv("AUDIT_EVENT_RETENTION_DAYS", "180")),
            "import_status_days": int(os.getenv("IMPORT_STATUS_RETENTION_DAYS", "90")),
            "immutable_archive_days": int(os.getenv("AUDIT_ARCHIVE_RETENTION_DAYS", "2555")),
        },
        "siem": {
            "mode": "s3_archive_or_customer_forwarder",
            "configured": bool(os.getenv("SIEM_HTTP_ENDPOINT", "").strip()),
        },
        "erp_adapters": {
            "sap": "not connected",
            "oracle": "not connected",
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
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Dict[str, object] = Depends(require_user),
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
        _record_audit_event(
            "import_validation_failed",
            entity,
            str(user.get("sub") or "unknown"),
            {"filename": file.filename, "rows_seen": result.rows_seen, "error_count": len(result.errors)},
            request,
        )
        _record_monitoring_event(
            "import_failure",
            "warning",
            f"{entity} import validation failed.",
            {"entity": entity, "rows_seen": result.rows_seen, "error_count": len(result.errors)},
        )
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
        _record_audit_event(
            "import_database_failed",
            entity,
            str(user.get("sub") or "unknown"),
            {"filename": file.filename, "rows_seen": db_result.rows_seen, "error_count": len(db_result.errors)},
            request,
        )
        _record_monitoring_event(
            "import_failure",
            "warning",
            f"{entity} import database load failed.",
            {"entity": entity, "rows_seen": db_result.rows_seen, "error_count": len(db_result.errors)},
        )
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
    _record_audit_event(
        "import_completed",
        entity,
        str(user.get("sub") or "unknown"),
        {
            "filename": file.filename,
            "rows_seen": db_result.rows_seen,
            "rows_imported": db_result.rows_imported,
            "raw_file_stored": bool(stored),
        },
        request,
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
    return {"rows": enrich_product_rows(recommend_fefo(lots, as_of=date.today()), data["products"]) if not lots.empty else []}


@app.get("/api/waste-risk-alerts")
def waste_risk(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    return {"rows": enrich_product_rows(waste_risk_alerts(data["inventory_lots"], as_of=date.today(), horizon_days=90), data["products"])}


@app.get("/api/forecasts")
def forecasts(db: Session = Depends(get_db), sku: Optional[str] = None, _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    products = data["products"]
    skus = [sku] if sku else (products["sku"].tolist() if not products.empty else [])
    engine = ForecastEngine()
    return {"rows": engine.forecast_all(data["orders"], skus, as_of=date.today())}


@app.get("/api/validation/forecast")
def forecast_validation(
    horizon_days: int = 30,
    db: Session = Depends(get_db),
    _: Dict[str, object] = Depends(require_user),
):
    bounded_horizon = max(7, min(horizon_days, 90))
    data = load_core_dataframes(db)
    return forecast_backtest(
        data["orders"],
        data["products"],
        as_of=date.today(),
        horizon_days=bounded_horizon,
    )


@app.get("/api/reorder-recommendations")
def reorder_recommendations(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    data = load_core_dataframes(db)
    products = data["products"]
    return {
        "rows": enrich_product_rows(generate_reorder_recommendations(
            inventory_lots=data["inventory_lots"],
            orders=data["orders"],
            inbound_shipments=data["inbound_shipments"],
            customers=data["customers"],
            skus=products["sku"].tolist() if not products.empty else None,
            as_of=date.today(),
            lead_time_days=settings.supplier_lead_time_days,
        ), products)
    }


@app.post("/api/query")
def query(
    request: QueryRequest,
    raw_request: Request,
    db: Session = Depends(get_db),
    user: Dict[str, object] = Depends(require_user),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")
    answer = answer_question(db, request.question, lead_time_days=settings.supplier_lead_time_days)
    if str(answer.get("ai_status", "")).startswith("llm_error"):
        _record_monitoring_event(
            "ai_failure",
            "warning",
            "AI query augmentation failed and fell back to safe materialized views.",
            {"template": answer.get("template"), "ai_error": answer.get("ai_error")},
        )
    _record_audit_event(
        "query_answered",
        str(answer.get("template", "unsupported")),
        str(user.get("sub") or "unknown"),
        {"question_preview": request.question[:160], "row_count": len(answer.get("rows", []))},
        raw_request,
    )
    return answer


@app.get("/api/ai/status")
def ai_layer_status(_: Dict[str, object] = Depends(require_user)):
    return ai_status()


@app.get("/api/monitoring/summary")
def monitoring_summary(_: Dict[str, object] = Depends(require_user)):
    now = int(time.time())
    recent = [event for event in MONITORING_EVENTS if now - int(event.get("created_at_epoch", 0) or 0) <= 24 * 60 * 60]
    counts = {
        event_type: sum(1 for event in recent if event.get("event_type") == event_type)
        for event_type in ["api_error", "import_failure", "slow_request", "slow_job", "ai_failure"]
    }
    checks = [
        {
            "name": "API errors",
            "status": "attention" if counts["api_error"] else "ok",
            "count": counts["api_error"],
            "message": "Unhandled API errors captured in the last 24 hours.",
        },
        {
            "name": "Import failures",
            "status": "attention" if counts["import_failure"] else "ok",
            "count": counts["import_failure"],
            "message": "CSV/XLSX validation or database import failures in the last 24 hours.",
        },
        {
            "name": "Slow requests/jobs",
            "status": "attention" if counts["slow_request"] + counts["slow_job"] else "ok",
            "count": counts["slow_request"] + counts["slow_job"],
            "message": "Requests over 2s or recommendation jobs over 10s.",
        },
        {
            "name": "Failed AI calls",
            "status": "attention" if counts["ai_failure"] else "ok",
            "count": counts["ai_failure"],
            "message": "LLM failures that fell back to safe materialized views.",
        },
    ]
    return {
        "generated_at_epoch": now,
        "window_hours": 24,
        "checks": checks,
        "events": list(reversed(recent[-25:])),
        "storage": "in_memory_local",
    }


@app.get("/api/audit-events")
def audit_events(limit: int = 100, _: Dict[str, object] = Depends(require_user)):
    bounded_limit = max(1, min(limit, 250))
    rows = list(reversed(AUDIT_EVENTS[-bounded_limit:]))
    return {"rows": rows, "count": len(rows), "storage": "in_memory_local"}


@app.get("/api/action-reviews")
def list_action_reviews(
    db: Session = Depends(get_db),
    _: Dict[str, object] = Depends(require_user),
):
    reviews = db.query(ActionReview).order_by(ActionReview.updated_at.desc()).all()
    return {
        "rows": [
            {
                "action_key": row.action_key,
                "status": row.status,
                "note": row.note,
                "action_snapshot": json.loads(row.action_snapshot or "{}"),
                "updated_by": row.updated_by,
                "approved_by": row.approved_by,
                "approved_at": row.approved_at.isoformat() if row.approved_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in reviews
        ],
        "count": len(reviews),
        "storage": "server",
    }


@app.post("/api/action-reviews")
def upsert_action_review(
    request: ActionReviewRequest,
    raw_request: Request,
    db: Session = Depends(get_db),
    user: Dict[str, object] = Depends(require_user),
):
    if not request.action_key.strip():
        raise HTTPException(status_code=400, detail="action_key is required.")
    if request.status not in {"open", "accepted", "dismissed"}:
        raise HTTPException(status_code=400, detail="status must be open, accepted, or dismissed.")
    if request.status == "accepted" and not can_approve_actions(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approver or admin roles can approve planner actions.",
        )

    row = db.get(ActionReview, request.action_key)
    if row is None:
        row = ActionReview(action_key=request.action_key)
        db.add(row)
    row.status = request.status
    row.note = request.note
    row.action_snapshot = json.dumps(request.action_snapshot, separators=(",", ":"), default=str)
    row.updated_by = str(user.get("sub") or "unknown")
    if request.status == "accepted":
        row.approved_by = str(user.get("sub") or "unknown")
        row.approved_at = datetime.now(timezone.utc)
    elif request.status == "open":
        row.approved_by = None
        row.approved_at = None
    db.commit()
    db.refresh(row)
    _record_audit_event(
        "action_review_updated",
        str(request.action_snapshot.get("sku") or request.action_snapshot.get("action_type") or "planner_action"),
        str(user.get("sub") or "unknown"),
        {"action_key": request.action_key, "status": request.status},
        raw_request,
    )
    return {
        "row": {
            "action_key": row.action_key,
            "status": row.status,
            "note": row.note,
            "action_snapshot": json.loads(row.action_snapshot or "{}"),
            "updated_by": row.updated_by,
            "approved_by": row.approved_by,
            "approved_at": row.approved_at.isoformat() if row.approved_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
        "storage": "server",
    }


@app.post("/api/action-reviews/clear")
def clear_action_reviews(
    request: Request,
    db: Session = Depends(get_db),
    user: Dict[str, object] = Depends(require_user),
):
    if not can_approve_actions(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approver or admin roles can clear planner review history.",
        )
    deleted = db.query(ActionReview).delete()
    db.commit()
    _record_audit_event(
        "action_reviews_cleared",
        "planner_actions",
        str(user.get("sub") or "unknown"),
        {"deleted": deleted},
        request,
    )
    return {"deleted": deleted, "storage": "server"}


@app.post("/api/jobs/recalculate")
def recalculate(db: Session = Depends(get_db), _: Dict[str, object] = Depends(require_user)):
    started = time.perf_counter()
    counts = refresh_recommendation_tables(
        db,
        as_of=date.today(),
        lead_time_days=settings.supplier_lead_time_days,
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    if duration_ms >= SLOW_JOB_MS:
        _record_monitoring_event(
            "slow_job",
            "warning",
            f"Recommendation refresh took {duration_ms} ms.",
            {"duration_ms": duration_ms, "counts": counts},
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
