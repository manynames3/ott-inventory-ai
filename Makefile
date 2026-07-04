PYTHON ?= $(shell command -v python3.12 || command -v python3.11 || command -v python3)
BACKEND_VENV ?= backend/.venv

.PHONY: setup-backend test-backend test-lambda test-frontend audit-frontend test-terraform verify

setup-backend:
	$(PYTHON) -m venv $(BACKEND_VENV)
	$(BACKEND_VENV)/bin/python -m pip install --upgrade pip
	$(BACKEND_VENV)/bin/pip install -r backend/requirements.txt

test-backend: setup-backend
	$(BACKEND_VENV)/bin/python -m unittest discover -s backend/tests/unit -p 'test_*.py'

test-lambda:
	$(PYTHON) -m py_compile infra/terraform/lambda_src/api/index.py infra/terraform/lambda_src/import_worker/index.py infra/terraform/lambda_src/refresh_worker/index.py

test-frontend:
	cd frontend && npm ci && npm run typecheck && npm run build

audit-frontend:
	cd frontend && npm audit --audit-level=high

test-terraform:
	cd infra/terraform && terraform fmt -check -recursive && terraform init -backend=false && terraform validate -no-color

verify: test-backend test-lambda test-frontend audit-frontend test-terraform
