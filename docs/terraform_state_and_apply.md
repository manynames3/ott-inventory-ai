# Terraform State And Apply Runbook

The hosted AWS stack must be applied with a remote Terraform state backend. Do not run `terraform apply` from a fresh checkout with no state file; Terraform will plan to create resources that may already exist.

## Backend Contract

Use an S3 backend config based on:

```bash
cp infra/terraform/backend.hcl.example infra/terraform/backend.hcl
```

Then edit the bucket name if a different AWS account or region is used.

Recommended backend:

- Bucket: `ott-inventory-ai-terraform-state-636305658578-us-west-2`
- Key: `mvp/terraform.tfstate`
- Region: `us-west-2`
- Encryption: enabled

The bucket above exists in AWS account `636305658578` with versioning, encryption, and public access blocking enabled.

Create the backend bucket once before `terraform init`:

```bash
aws s3api create-bucket \
  --bucket ott-inventory-ai-terraform-state-636305658578-us-west-2 \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2

aws s3api put-bucket-versioning \
  --bucket ott-inventory-ai-terraform-state-636305658578-us-west-2 \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket ott-inventory-ai-terraform-state-636305658578-us-west-2 \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket ott-inventory-ai-terraform-state-636305658578-us-west-2 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## Normal Plan And Apply

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

## Existing Live Stack

If AWS resources already exist outside the configured state, import them before applying. At minimum, confirm these resource families are represented in state:

- S3 raw import bucket and optional audit archive bucket
- DynamoDB records, views, and imports tables
- Lambda functions and IAM role/policies
- Cognito user pool, app client, domain, and groups
- API Gateway API, integrations, routes, authorizer, stage, and Lambda permission
- Optional Scheduler, SNS, Budget, and Transfer Family resources

Use:

```bash
terraform state list
terraform import <terraform_address> <aws_resource_id>
```

Run `terraform plan` after imports and only apply when the plan is limited to intended changes.

## CI Validation

GitHub Actions intentionally uses:

```bash
terraform init -backend=false
terraform validate
```

That validates syntax without touching production state.
