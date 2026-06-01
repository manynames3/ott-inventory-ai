# AWS Backend And Excel Intake Architecture

This build adds the pilot path a buyer can actually evaluate: login, downloadable templates, Excel/CSV uploads, S3 raw-file retention, and fast natural-language insights over normalized operational data.

For the MVP, the hosted architecture must keep idle cost near zero. Do not use always-on compute or databases for the first hosted demo. See [low_idle_mvp_architecture.md](low_idle_mvp_architecture.md) for the target <$10/month design.

Provision this path with Terraform from [../infra/terraform](../infra/terraform). Do not use CloudFormation for the MVP infrastructure.

## Recommended AWS Services

| Need | Low-Idle MVP Service | Why |
| --- | --- | --- |
| Hosted API | AWS Lambda Function URL | Runs only when invoked and avoids API Gateway cost for the first simple API. |
| Fast operational queries | Amazon DynamoDB on-demand | Pay-per-request query store with no provisioned idle throughput. |
| Raw Excel/CSV retention | Amazon S3 | Durable, low-cost storage for original uploads and audit trail. |
| Import jobs | S3 event -> Lambda | Runs validation and recommendation refresh only after file upload. |
| Scheduled refreshes | EventBridge Scheduler -> Lambda | Optional timed jobs with no always-on worker. |
| Secrets | Lambda env vars, SSM Parameter Store, or Secrets Manager | Keeps credentials and signing secrets out of code. |
| Production login | Cloudflare Access, Cognito, or company SSO | Replaces MVP env-based login when a real buyer needs managed identity. |
| Ad-hoc lake analytics | Athena or Glue | Optional later layer for raw S3 data exploration. |
| AI-assisted query expansion | Amazon Bedrock | Optional later layer for permissioned text-to-SQL or query suggestions. |

## Why S3 Plus DynamoDB For The Hosted MVP

The user uploads Excel files, but Excel is not the fast query layer.

For the low-idle hosted MVP, Inventory AI uses three layers:

1. **S3 raw zone**: Stores the original `.csv`, `.xlsx`, or `.xlsm` file exactly as uploaded. This supports auditability, reprocessing, and future data-lake workflows.
2. **DynamoDB canonical records**: Stores normalized products, lots, orders, customers, and inbound shipments in a pay-per-request serving store.
3. **Materialized insight views**: Stores precomputed dashboard KPIs, FEFO recommendations, waste-risk alerts, stockout risks, reorder recommendations, and customer-SKU cadence records.

This keeps the pilot fast and defensible:

- S3 answers "what source file did the user provide?"
- DynamoDB answers "which precomputed recommendation or canonical record should I return?"
- Lambda answers "how do I map this natural-language question to a safe view read?"

PostgreSQL remains useful for local development and later paid pilots because the domain is relational. It should not be the first hosted choice when the budget target is under $10/month. Athena is useful for ad-hoc analytics over large S3 partitions, but the planner workflow needs responsive application queries. That is why the MVP should materialize high-value views after upload.

## Upload Flow

```text
Planner selects Excel/CSV in the Cloudflare Pages app
        |
        v
Lambda API creates an authenticated presigned S3 URL
        |
        v
Browser uploads the raw file directly to private S3
        |
        v
S3 event invokes import Lambda
        |
        v
Lambda validates entity and required columns
        |
        v
Normalize dates and numeric fields
        |
        v
DynamoDB canonical records
        |
        v
DynamoDB materialized recommendation views
        |
        v
Dashboard and natural-language query answers
```

The import status endpoint tells the user:

- how many rows were imported,
- whether the raw file was stored in S3,
- whether recommendation tables were refreshed,
- which natural-language questions to ask next.

## Environment Variables

Required for backend login:

```bash
AUTH_ENABLED=true
AUTH_USERNAME=planner@example.com
AUTH_PASSWORD=<store in Secrets Manager or host secret settings>
AUTH_SECRET_KEY=<long random signing secret>
AUTH_TOKEN_TTL_MINUTES=720
```

For the Terraform Lambda path, store credentials in SSM Parameter Store and pass only the parameter names to Terraform:

```bash
auth_username_parameter_name   = "/inventory-ai/mvp/auth/username"
auth_password_parameter_name   = "/inventory-ai/mvp/auth/password"
auth_secret_key_parameter_name = "/inventory-ai/mvp/auth/secret-key"
```

Optional S3 raw-file storage:

```bash
AWS_REGION=us-west-2
AWS_S3_RAW_IMPORT_BUCKET=<your-private-raw-import-bucket>
AWS_S3_IMPORT_PREFIX=inventory-ai/raw-imports
```

Low-idle DynamoDB tables:

```bash
AWS_DYNAMODB_RECORDS_TABLE=inventory_ai_records
AWS_DYNAMODB_VIEWS_TABLE=inventory_ai_views
AWS_DYNAMODB_IMPORTS_TABLE=inventory_ai_imports
```

The backend uses the default AWS credential chain. On AWS, prefer an IAM role attached to Lambda instead of static access keys.

## S3 Bucket Policy Guidance

Use a private bucket. Do not make uploaded files public.

Minimum permissions for the backend role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/inventory-ai/raw-imports/*"
    }
  ]
}
```

Add encryption, lifecycle rules, and object lock according to customer data-retention requirements.

## Low-Idle Hosted Backend Deployment Shape

For the first hosted pilot:

1. Keep the frontend on Cloudflare Pages static hosting.
2. Create a private S3 bucket for raw Excel/CSV uploads.
3. Create DynamoDB on-demand tables for canonical records, materialized insight views, and import status.
4. Deploy a Lambda API behind a Lambda Function URL.
5. Add an import Lambda triggered by S3 object-created events.
6. Add optional EventBridge Scheduler refreshes if recommendations need periodic recalculation.
7. Configure environment variables from Lambda env vars, SSM Parameter Store, or Secrets Manager.
8. Set Cloudflare Pages variables:
   - `NEXT_PUBLIC_DEMO_MODE=false`
   - `NEXT_PUBLIC_API_BASE_URL=https://<backend-host>`
9. Set backend `CORS_ORIGINS=https://ott-inventory-ai.pages.dev`.
10. Seed demo data by uploading the files in `sample_data/ottogi_demo/`.

## Services To Avoid For The <$10 MVP

Do not use these as the default hosted MVP path:

- ECS Fargate
- App Runner
- RDS PostgreSQL
- Aurora PostgreSQL
- Application Load Balancer
- NAT Gateway

Those services can be appropriate later, but they create baseline cost before usage is proven. Use them only after a paid pilot requires relational SQL, longer-running jobs, private networking, or heavier workloads.

## Natural-Language Query Strategy

The MVP uses rule-based templates over structured tables, not unrestricted SQL generation. This is deliberate:

- It avoids unsafe arbitrary SQL.
- It gives buyers predictable, auditable answers.
- It supports the highest-value questions immediately:
  - "Which inventory expires soon?"
  - "Which SKUs will stock out in the next 30 days?"
  - "Who needs another order right now?"
  - "What should we reorder this week?"

Future versions can add Bedrock-assisted text-to-SQL with guardrails:

- read-only database role,
- table/view allowlist,
- row limits,
- query timeout,
- SQL explanation before execution,
- audit logs for every generated query.

## Why This Matters For A Buyer Demo

This architecture lets a VP of Operations or Supply Chain Manager evaluate the product without a major IT project:

- They can upload familiar Excel exports.
- The system stores the raw source file for traceability.
- The dashboard updates from normalized operational tables.
- They can ask human-language inventory questions immediately.
- The pilot can start with CSV/Excel and graduate to SAP, Oracle, EDI, or WMS adapters after ROI is proven.
