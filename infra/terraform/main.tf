data "aws_caller_identity" "current" {}

locals {
  name_prefix = lower("${var.project_name}-${var.environment}")

  raw_import_bucket_name = var.raw_import_bucket_name != "" ? var.raw_import_bucket_name : lower("${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.aws_region}-raw-imports")

  records_table_name = "${local.name_prefix}-records"
  views_table_name   = "${local.name_prefix}-views"
  imports_table_name = "${local.name_prefix}-imports"

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      CostProfile = "low-idle-mvp"
    },
    var.tags
  )

  ssm_parameter_names = compact([
    var.auth_username_parameter_name,
    var.auth_password_parameter_name,
    var.auth_secret_key_parameter_name,
    var.auth_users_json_parameter_name,
    var.openai_api_key_parameter_name
  ])
}

resource "aws_s3_bucket" "raw_imports" {
  bucket = local.raw_import_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "raw_imports" {
  bucket = aws_s3_bucket.raw_imports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw_imports" {
  bucket = aws_s3_bucket.raw_imports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "raw_imports" {
  bucket = aws_s3_bucket.raw_imports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "raw_imports" {
  bucket = aws_s3_bucket.raw_imports.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_imports" {
  count  = var.raw_file_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.raw_imports.id

  rule {
    id     = "expire-raw-imports"
    status = "Enabled"

    filter {
      prefix = var.raw_import_prefix
    }

    expiration {
      days = var.raw_file_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_dynamodb_table" "records" {
  name         = local.records_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "views" {
  name         = local.views_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "imports" {
  name         = local.imports_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

data "archive_file" "api_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/build/api.zip"
}

data "archive_file" "import_worker_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/build/import_worker.zip"
}

data "archive_file" "refresh_worker_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/build/refresh_worker.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_data_access" {
  statement {
    sid = "RawImportBucketObjects"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = ["${aws_s3_bucket.raw_imports.arn}/*"]
  }

  statement {
    sid       = "RawImportBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.raw_imports.arn]
  }

  statement {
    sid = "DynamoDbData"
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]
    resources = [
      aws_dynamodb_table.records.arn,
      aws_dynamodb_table.views.arn,
      aws_dynamodb_table.imports.arn
    ]
  }

  dynamic "statement" {
    for_each = length(local.ssm_parameter_names) > 0 ? [1] : []

    content {
      sid       = "ReadAuthParameters"
      actions   = ["ssm:GetParameter", "ssm:GetParameters"]
      resources = [for name in local.ssm_parameter_names : "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${startswith(name, "/") ? name : "/${name}"}"]
    }
  }
}

resource "aws_iam_role_policy" "lambda_data_access" {
  name   = "${local.name_prefix}-lambda-data-access"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_data_access.json
}

locals {
  lambda_environment = {
    PROJECT_NAME                   = var.project_name
    ENVIRONMENT                    = var.environment
    TENANT_ID                      = var.tenant_id
    AWS_S3_RAW_IMPORT_BUCKET       = aws_s3_bucket.raw_imports.bucket
    AWS_S3_IMPORT_PREFIX           = var.raw_import_prefix
    AWS_DYNAMODB_RECORDS_TABLE     = aws_dynamodb_table.records.name
    AWS_DYNAMODB_VIEWS_TABLE       = aws_dynamodb_table.views.name
    AWS_DYNAMODB_IMPORTS_TABLE     = aws_dynamodb_table.imports.name
    CORS_ORIGINS                   = join(",", var.allowed_origins)
    AUTH_USERNAME_PARAMETER_NAME   = var.auth_username_parameter_name
    AUTH_PASSWORD_PARAMETER_NAME   = var.auth_password_parameter_name
    AUTH_ROLE                      = var.auth_role
    AUTH_USERS_JSON_PARAMETER_NAME = var.auth_users_json_parameter_name
    AUTH_SECRET_KEY_PARAMETER_NAME = var.auth_secret_key_parameter_name
    OPENAI_API_KEY_PARAMETER_NAME  = var.openai_api_key_parameter_name
    OPENAI_MODEL                   = var.openai_model
    AI_QUERY_ENABLED               = tostring(var.ai_query_enabled)
  }
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  description   = "Low-idle StockSense AI API endpoint for templates, upload URLs, and query reads."
  role          = aws_iam_role.lambda.arn
  handler       = "api.index.handler"
  runtime       = var.lambda_runtime
  architectures = ["arm64"]
  filename      = data.archive_file.api_lambda.output_path
  memory_size   = var.api_lambda_memory_mb
  timeout       = var.api_lambda_timeout_seconds

  reserved_concurrent_executions = var.reserved_concurrency
  source_code_hash               = data.archive_file.api_lambda.output_base64sha256

  environment {
    variables = local.lambda_environment
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "import_worker" {
  function_name = "${local.name_prefix}-import-worker"
  description   = "Low-idle StockSense AI import worker triggered by S3 raw upload events."
  role          = aws_iam_role.lambda.arn
  handler       = "import_worker.index.handler"
  runtime       = var.lambda_runtime
  architectures = ["arm64"]
  filename      = data.archive_file.import_worker_lambda.output_path
  memory_size   = var.job_lambda_memory_mb
  timeout       = var.job_lambda_timeout_seconds

  reserved_concurrent_executions = var.reserved_concurrency
  source_code_hash               = data.archive_file.import_worker_lambda.output_base64sha256

  environment {
    variables = local.lambda_environment
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "refresh_worker" {
  function_name = "${local.name_prefix}-refresh-worker"
  description   = "Low-idle StockSense AI recommendation refresh worker."
  role          = aws_iam_role.lambda.arn
  handler       = "refresh_worker.index.handler"
  runtime       = var.lambda_runtime
  architectures = ["arm64"]
  filename      = data.archive_file.refresh_worker_lambda.output_path
  memory_size   = var.job_lambda_memory_mb
  timeout       = var.job_lambda_timeout_seconds

  reserved_concurrent_executions = var.reserved_concurrency
  source_code_hash               = data.archive_file.refresh_worker_lambda.output_base64sha256

  environment {
    variables = local.lambda_environment
  }

  tags = local.common_tags
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "allow_s3_import_worker" {
  statement_id  = "AllowS3InvokeImportWorker"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.import_worker.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.raw_imports.arn
}

resource "aws_s3_bucket_notification" "raw_imports" {
  bucket = aws_s3_bucket.raw_imports.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.import_worker.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.raw_import_prefix
  }

  depends_on = [aws_lambda_permission.allow_s3_import_worker]
}

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  count              = var.enable_refresh_schedule ? 1 : 0
  name               = "${local.name_prefix}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "scheduler_invoke" {
  count = var.enable_refresh_schedule ? 1 : 0

  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.refresh_worker.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  count  = var.enable_refresh_schedule ? 1 : 0
  name   = "${local.name_prefix}-scheduler-invoke"
  role   = aws_iam_role.scheduler[0].id
  policy = data.aws_iam_policy_document.scheduler_invoke[0].json
}

resource "aws_scheduler_schedule" "refresh" {
  count = var.enable_refresh_schedule ? 1 : 0

  name                = "${local.name_prefix}-refresh"
  description         = "Periodic StockSense AI recommendation refresh."
  schedule_expression = var.refresh_schedule_expression

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.refresh_worker.arn
    role_arn = aws_iam_role.scheduler[0].arn
  }
}

resource "aws_budgets_budget" "monthly" {
  count = var.enable_budget && var.budget_email != "" ? 1 : 0

  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}
