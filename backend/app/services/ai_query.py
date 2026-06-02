from __future__ import annotations

import json
import os
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import boto3


def _enabled() -> bool:
    return os.getenv("AI_QUERY_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


def _model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-5-mini").strip() or "gpt-5-mini"


def _api_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    parameter_name = os.getenv("OPENAI_API_KEY_PARAMETER_NAME", "").strip()
    if key or not parameter_name:
        return key
    try:
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-west-2"
        return boto3.client("ssm", region_name=region).get_parameter(Name=parameter_name, WithDecryption=True)["Parameter"][
            "Value"
        ].strip()
    except Exception:
        return ""


def ai_status() -> Dict[str, Any]:
    configured = bool(_api_key())
    enabled = _enabled()
    return {
        "provider": "openai",
        "model": _model(),
        "enabled": enabled,
        "configured": configured,
        "mode": "llm_augmented_safe_views" if enabled and configured else "rule_based_fallback",
        "secret_source": "ssm_parameter" if os.getenv("OPENAI_API_KEY_PARAMETER_NAME", "").strip() else "environment",
    }


def _schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["explanation", "action_summary", "risk_notes", "confidence_note"],
        "properties": {
            "explanation": {"type": "string"},
            "action_summary": {"type": "array", "minItems": 1, "maxItems": 5, "items": {"type": "string"}},
            "risk_notes": {"type": "array", "maxItems": 4, "items": {"type": "string"}},
            "confidence_note": {"type": "string"},
        },
    }


def _compact_rows(rows: List[Dict[str, Any]], limit: int = 12) -> List[Dict[str, Any]]:
    preferred = [
        "sku",
        "product_name",
        "category",
        "warehouse",
        "status",
        "lot_id",
        "ship_first_lot",
        "quantity_at_risk",
        "at_risk_value",
        "recommended_order_qty",
        "estimated_order_value",
        "reorder_by_date",
        "expiration_date",
        "risk_bucket",
        "customer_id",
        "name",
        "region",
        "channel",
        "suggested_action",
        "action",
        "reason",
        "confidence",
        "confidence_reason",
    ]
    return [{key: row.get(key) for key in preferred if key in row} for row in rows[:limit]]


def _extract_text(response: Dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return str(response["output_text"])
    chunks = []
    for item in response.get("output", []) or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content", []) or []:
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(chunks).strip()


def augment_query_answer(question: str, answer: Dict[str, Any]) -> Dict[str, Any]:
    status = ai_status()
    answer["ai"] = status
    if not status["enabled"] or not status["configured"] or not answer.get("rows"):
        answer["ai_status"] = status["mode"]
        return answer

    context = {
        "question": question,
        "matched_template": answer.get("template"),
        "safe_query_mode": answer.get("safe_query_mode"),
        "row_count": len(answer.get("rows", [])),
        "columns": answer.get("columns", []),
        "rows": _compact_rows(answer.get("rows", [])),
    }
    payload = {
        "model": status["model"],
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are StockSense AI for food and CPG inventory planners. Use only the provided JSON. "
                            "Do not invent SKUs, lots, dates, costs, customers, or SQL. Explain the matched safe view "
                            "as planner-ready actions with confidence caveats."
                        ),
                    }
                ],
            },
            {"role": "user", "content": [{"type": "input_text", "text": json.dumps(context, default=str)}]},
        ],
        "text": {"format": {"type": "json_schema", "name": "stocksense_query_answer", "strict": True, "schema": _schema()}},
        "reasoning": {"effort": "minimal"},
        "store": False,
        "max_output_tokens": 900,
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=18) as response:
            parsed = json.loads(response.read().decode("utf-8"))
        model_json = json.loads(_extract_text(parsed))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        answer["ai_status"] = "llm_error_rule_based_fallback"
        answer["ai_error"] = type(exc).__name__
        return answer

    answer["explanation"] = str(model_json.get("explanation") or answer.get("explanation") or "")
    if isinstance(model_json.get("action_summary"), list) and model_json["action_summary"]:
        answer["action_summary"] = [str(item) for item in model_json["action_summary"][:5]]
    answer["ai_risk_notes"] = [str(item) for item in model_json.get("risk_notes", [])[:4] if str(item).strip()]
    answer["ai_confidence_note"] = str(model_json.get("confidence_note") or "")
    answer["ai_status"] = "llm_augmented"
    answer["safe_query_mode"] = "openai_augmented_materialized_views"
    return answer
