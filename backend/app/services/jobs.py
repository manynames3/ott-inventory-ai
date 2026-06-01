from __future__ import annotations

from datetime import date
from typing import Dict, List

import pandas as pd
from sqlalchemy.orm import Session

from app.models import ReorderRecommendation, WasteRiskAlert
from app.services.dataframes import load_core_dataframes
from app.services.fefo import waste_risk_alerts
from app.services.reorder import generate_reorder_recommendations


def refresh_recommendation_tables(
    session: Session,
    as_of: date,
    lead_time_days: int,
) -> Dict[str, int]:
    data = load_core_dataframes(session)
    products = data["products"]
    inventory_lots = data["inventory_lots"]
    orders = data["orders"]
    inbound = data["inbound_shipments"]

    session.query(ReorderRecommendation).delete()
    session.query(WasteRiskAlert).delete()

    if inventory_lots.empty:
        session.commit()
        return {"reorder_recommendations": 0, "waste_risk_alerts": 0}

    recommendations = generate_reorder_recommendations(
        inventory_lots=inventory_lots,
        orders=orders,
        inbound_shipments=inbound,
        skus=products["sku"].tolist() if not products.empty else None,
        as_of=as_of,
        lead_time_days=lead_time_days,
    )
    alerts = waste_risk_alerts(inventory_lots, as_of=as_of, horizon_days=90)

    for recommendation in recommendations:
        session.add(
            ReorderRecommendation(
                sku=recommendation["sku"],
                warehouse=recommendation["warehouse"],
                recommended_order_qty=int(recommendation["recommended_order_qty"]),
                reorder_by_date=pd.to_datetime(recommendation["reorder_by_date"]).date(),
                reason=recommendation["reason"],
                confidence=float(recommendation["confidence"]),
                status=recommendation["status"],
            )
        )

    for alert in alerts:
        session.add(
            WasteRiskAlert(
                sku=alert["sku"],
                lot_id=alert["lot_id"],
                warehouse=alert["warehouse"],
                quantity_at_risk=int(alert["quantity_at_risk"]),
                expiration_date=pd.to_datetime(alert["expiration_date"]).date(),
                suggested_action=alert["suggested_action"],
                risk_bucket=alert["risk_bucket"],
            )
        )

    session.commit()
    return {"reorder_recommendations": len(recommendations), "waste_risk_alerts": len(alerts)}

