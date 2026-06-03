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
    tenant_id="default",
    cors_origins=["http://localhost:3000"],
    supplier_lead_time_days=30,
    forecast_interval_seconds=3600,
    import_queue_dir="/tmp",
    auth_enabled=True,
    auth_username="planner@example.com",
    auth_password="secret",
    auth_role="approver",
    auth_users_json="",
    auth_secret_key="test-secret-key-with-enough-entropy-for-tests",
    auth_token_ttl_minutes=10,
    aws_region="us-west-2",
    aws_s3_raw_import_bucket="",
    aws_s3_import_prefix="stocksense/raw-imports",
    aws_dynamodb_records_table="stocksense_records",
    aws_dynamodb_views_table="stocksense_views",
    aws_dynamodb_imports_table="stocksense_imports",
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
        self.assertEqual(payload["aud"], "stocksense")
        self.assertEqual(payload["tenant_id"], "default")
        self.assertEqual(payload["role"], "approver")

    def test_multi_user_roles_round_trip(self):
        if authenticate is None:
            self.skipTest("fastapi is not installed in this Python environment")
        settings = replace(
            TEST_SETTINGS,
            auth_users_json=(
                '{"planner@example.com":{"password":"planner-secret","role":"planner"},'
                '"manager@example.com":{"password":"manager-secret","role":"approver"}}'
            ),
        )

        self.assertTrue(authenticate("planner@example.com", "planner-secret", settings=settings))
        self.assertFalse(authenticate("planner@example.com", "manager-secret", settings=settings))

        planner_payload = verify_access_token(create_access_token("planner@example.com", settings=settings), settings=settings)
        manager_payload = verify_access_token(create_access_token("manager@example.com", settings=settings), settings=settings)

        self.assertEqual(planner_payload["role"], "planner")
        self.assertEqual(manager_payload["role"], "approver")

    def test_expired_token_rejected(self):
        if create_access_token is None or verify_access_token is None:
            self.skipTest("fastapi is not installed in this Python environment")
        expired_settings = replace(TEST_SETTINGS, auth_token_ttl_minutes=-1)
        token = create_access_token("planner@example.com", settings=expired_settings)

        with self.assertRaises(Exception):
            verify_access_token(token, settings=TEST_SETTINGS)

    def test_wrong_tenant_token_rejected(self):
        if create_access_token is None or verify_access_token is None:
            self.skipTest("fastapi is not installed in this Python environment")
        token = create_access_token("planner@example.com", settings=TEST_SETTINGS)

        with self.assertRaises(Exception):
            verify_access_token(token, settings=replace(TEST_SETTINGS, tenant_id="other-pilot"))

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
