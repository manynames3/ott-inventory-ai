# AWS Backend And Excel Intake Architecture

This build adds the pilot path a buyer can actually evaluate: a hosted backend with login, downloadable templates, Excel/CSV uploads, S3 raw-file retention, and fast natural-language insights over normalized operational data.

## Recommended AWS Services

| Need | Recommended AWS Service | Why |
| --- | --- | --- |
| Hosted FastAPI backend | AWS App Runner or ECS Fargate | Runs Python, Pandas, NumPy, and API code without forcing the backend into an edge runtime. |
| Fast operational queries | Amazon RDS PostgreSQL or Aurora PostgreSQL | Low-latency joins across products, lots, orders, customers, and inbound shipments. |
| Raw Excel/CSV retention | Amazon S3 | Durable, low-cost storage for original uploads and audit trail. |
| Secrets | AWS Secrets Manager or SSM Parameter Store | Keeps credentials and signing secrets out of code. |
| Production login | Amazon Cognito or company SSO | Replaces MVP env-based login for real users. |
| Ad-hoc lake analytics | AWS Glue + Athena | Optional later layer for raw S3 data exploration. |
| AI-assisted query expansion | Amazon Bedrock | Optional later layer for permissioned text-to-SQL or query suggestions. |

## Why S3 Plus PostgreSQL

The user uploads Excel files, but Excel is not the fast query layer.

Inventory AI uses two layers:

1. **S3 raw zone**: Stores the original `.csv`, `.xlsx`, or `.xlsm` file exactly as uploaded. This supports auditability, reprocessing, and future data-lake workflows.
2. **PostgreSQL serving layer**: Stores normalized rows in relational tables for low-latency dashboard and natural-language query responses.

This keeps the pilot fast and defensible:

- S3 answers "what source file did the user provide?"
- PostgreSQL answers "which SKUs will stock out, which lots expire soon, and what should we reorder?"

Athena is useful for ad-hoc analytics over large S3 partitions, but the planner workflow needs responsive application queries. That is why the MVP imports into PostgreSQL immediately after upload.

## Upload Flow

```text
Planner uploads Excel/CSV
        |
        v
FastAPI validates entity and required columns
        |
        +--> Optional S3 raw upload
        |
        v
Pandas normalizes dates and numeric fields
        |
        v
PostgreSQL merge/upsert by business key
        |
        v
Recommendation refresh
        |
        v
Dashboard and natural-language query answers
```

The API response tells the user:

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

Optional S3 raw-file storage:

```bash
AWS_REGION=us-west-2
AWS_S3_RAW_IMPORT_BUCKET=<your-private-raw-import-bucket>
AWS_S3_IMPORT_PREFIX=inventory-ai/raw-imports
```

The backend uses the default AWS credential chain. On AWS, prefer an IAM role attached to App Runner/ECS instead of static access keys.

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

## Hosted Backend Deployment Shape

For the first hosted pilot:

1. Create an RDS/Aurora PostgreSQL database.
2. Run `backend/migrations/001_init.sql`.
3. Deploy the FastAPI backend to App Runner or ECS Fargate.
4. Configure environment variables from Secrets Manager or App Runner secret references.
5. Set Cloudflare Pages variables:
   - `NEXT_PUBLIC_DEMO_MODE=false`
   - `NEXT_PUBLIC_API_BASE_URL=https://<backend-host>`
6. Set backend `CORS_ORIGINS=https://ott-inventory-ai.pages.dev`.
7. Seed demo data with `python -m app.seed_ottogi_demo`, or enable `ALLOW_DEMO_SEED=true` only in a controlled demo environment and call `/api/demo/seed-ottogi`.

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
- table allowlist,
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
