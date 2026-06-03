from __future__ import annotations

import copy
import json
import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.ai_query import ai_status, augment_query_answer


BASE_ANSWER = {
    "template": "reorder_this_week",
    "safe_query_mode": "rule_based_materialized_views",
    "explanation": "Rule-based explanation.",
    "action_summary": ["Review replenishment."],
    "columns": ["sku", "recommended_order_qty", "reason"],
    "rows": [
        {
            "sku": "08252K",
            "product_name": "Ottogi Jin Ramen Hot Case",
            "recommended_order_qty": 120,
            "estimated_order_value": 4200,
            "reason": "Stockout risk due to lead-time demand.",
            "confidence": 0.82,
        }
    ],
}


class _FakeOpenAIResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        model_payload = {
            "explanation": "AI-planner explanation using the safe view.",
            "action_summary": ["Order 08252K this week.", "Confirm inbound timing before allocation."],
            "risk_notes": ["Lead-time demand is above effective inventory."],
            "confidence_note": "Confidence is strongest when recent order history is complete.",
        }
        return json.dumps({"output_text": json.dumps(model_payload)}).encode("utf-8")


class AIQueryTest(unittest.TestCase):
    def test_status_without_openai_key_falls_back(self):
        with patch.dict(
            os.environ,
            {
                "AI_QUERY_ENABLED": "true",
                "OPENAI_API_KEY": "",
                "OPENAI_API_KEY_PARAMETER_NAME": "",
                "OPENAI_MODEL": "gpt-5-mini",
            },
        ):
            status = ai_status()

        self.assertEqual(status["provider"], "openai")
        self.assertTrue(status["enabled"])
        self.assertFalse(status["configured"])
        self.assertEqual(status["mode"], "rule_based_fallback")

    def test_missing_key_preserves_rule_based_answer(self):
        answer = copy.deepcopy(BASE_ANSWER)
        with patch.dict(
            os.environ,
            {
                "AI_QUERY_ENABLED": "true",
                "OPENAI_API_KEY": "",
                "OPENAI_API_KEY_PARAMETER_NAME": "",
                "OPENAI_MODEL": "gpt-5-mini",
            },
        ):
            result = augment_query_answer("What should we reorder this week?", answer)

        self.assertEqual(result["ai_status"], "rule_based_fallback")
        self.assertEqual(result["safe_query_mode"], "rule_based_materialized_views")
        self.assertEqual(result["explanation"], "Rule-based explanation.")
        self.assertNotIn("ai_confidence_note", result)

    def test_configured_key_augments_safe_query_answer(self):
        answer = copy.deepcopy(BASE_ANSWER)
        with patch.dict(
            os.environ,
            {
                "AI_QUERY_ENABLED": "true",
                "OPENAI_API_KEY": "test-openai-key",
                "OPENAI_API_KEY_PARAMETER_NAME": "",
                "OPENAI_MODEL": "gpt-5-mini",
            },
        ):
            with patch("app.services.ai_query.urlopen", return_value=_FakeOpenAIResponse()):
                result = augment_query_answer("What should we reorder this week?", answer)

        self.assertEqual(result["ai_status"], "llm_augmented")
        self.assertEqual(result["safe_query_mode"], "openai_augmented_materialized_views")
        self.assertEqual(result["explanation"], "AI-planner explanation using the safe view.")
        self.assertEqual(result["action_summary"][0], "Order 08252K this week.")
        self.assertEqual(result["ai_risk_notes"], ["Lead-time demand is above effective inventory."])
        self.assertIn("recent order history", result["ai_confidence_note"])


if __name__ == "__main__":
    unittest.main()
