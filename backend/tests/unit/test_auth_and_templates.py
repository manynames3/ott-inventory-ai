from __future__ import annotations

import unittest
import os
import sys
import importlib.util
from dataclasses import replace
from io import BytesIO


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.config import Settings
from app.services.templates import csv_template, xlsx_template
from app.adapters.base import REQUIRED_COLUMNS

import pandas as pd

try:
    from app.auth import authenticate, create_access_token, verify_access_token  # type: ignore
except ModuleNotFoundError:
    authenticate = create_access_token = verify_access_token = None


TEST_SETTINGS = Settings(
    database_url="postgresql+psycopg://example",
    cors_origins=["http://localhost:3000"],
    supplier_lead_time_days=30,
    forecast_interval_seconds=3600,
    import_queue_dir="/tmp",
    auth_enabled=True,
    auth_username="planner@example.com",
    auth_password="secret",
    auth_secret_key="test-secret-key-with-enough-entropy-for-tests",
    auth_token_ttl_minutes=10,
    aws_region="us-west-2",
    aws_s3_raw_import_bucket="",
    aws_s3_import_prefix="inventory-ai/raw-imports",
    aws_dynamodb_records_table="inventory_ai_records",
    aws_dynamodb_views_table="inventory_ai_views",
    aws_dynamodb_imports_table="inventory_ai_imports",
    allow_demo_seed=False,
)


class AuthAndTemplatesTest(unittest.TestCase):
    def test_auth_token_round_trip(self):
        if authenticate is None:
            self.skipTest("fastapi is not installed in this Python environment")
        self.assertTrue(authenticate("planner@example.com", "secret", settings=TEST_SETTINGS))
        self.assertFalse(authenticate("planner@example.com", "wrong", settings=TEST_SETTINGS))

        token = create_access_token("planner@example.com", settings=TEST_SETTINGS)
        payload = verify_access_token(token, settings=TEST_SETTINGS)

        self.assertEqual(payload["sub"], "planner@example.com")
        self.assertEqual(payload["aud"], "inventory-ai")

    def test_expired_token_rejected(self):
        if create_access_token is None or verify_access_token is None:
            self.skipTest("fastapi is not installed in this Python environment")
        expired_settings = replace(TEST_SETTINGS, auth_token_ttl_minutes=-1)
        token = create_access_token("planner@example.com", settings=expired_settings)

        with self.assertRaises(Exception):
            verify_access_token(token, settings=TEST_SETTINGS)

    def test_csv_template_imports(self):
        content = csv_template("products")
        df = pd.read_csv(BytesIO(content))

        self.assertEqual(list(df.columns), REQUIRED_COLUMNS["products"])
        self.assertEqual(len(df), 1)

    def test_xlsx_template_imports(self):
        if importlib.util.find_spec("openpyxl") is None:
            self.skipTest("openpyxl is not installed in this Python environment")
        content = xlsx_template("products")
        df = pd.read_excel(BytesIO(content), engine="openpyxl")

        self.assertEqual(list(df.columns), REQUIRED_COLUMNS["products"])
        self.assertEqual(len(df), 1)


if __name__ == "__main__":
    unittest.main()
