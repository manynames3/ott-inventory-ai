data "aws_caller_identity" "current" {}

locals {
  name_prefix = lower("${var.project_name}-${var.environment}")

  raw_import_bucket_name = var.raw_import_bucket_name != "" ? var.raw_import_bucket_name : lower("${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.aws_region}-raw-imports")
  audit_archive_bucket_name = (
    var.audit_archive_bucket_name != ""
    ? var.audit_archive_bucket_name
    : lower("${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.aws_region}-audit-archive")
  )
  cognito_domain_prefix = var.cognito_domain_prefix != "" ? var.cognito_domain_prefix : lower("${local.name_prefix}-${data.aws_caller_identity.current.account_id}")

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

resource "aws_s3_bucket" "audit_archive" {
  count               = var.enable_immutable_audit_archive ? 1 : 0
  bucket              = local.audit_archive_bucket_name
  object_lock_enabled = true
  tags                = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "audit_archive" {
  count  = var.enable_immutable_audit_archive ? 1 : 0
  bucket = aws_s3_bucket.audit_archive[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_archive" {
  count  = var.enable_immutable_audit_archive ? 1 : 0
  bucket = aws_s3_bucket.audit_archive[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "audit_archive" {
  count  = var.enable_immutable_audit_archive ? 1 : 0
  bucket = aws_s3_bucket.audit_archive[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_archive" {
  count  = var.enable_immutable_audit_archive ? 1 : 0
  bucket = aws_s3_bucket.audit_archive[0].id

  depends_on = [aws_s3_bucket_versioning.audit_archive]

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.audit_archive_retention_days
    }
  }
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

  dynamic "statement" {
    for_each = var.enable_immutable_audit_archive ? [1] : []

    content {
      sid       = "ImmutableAuditArchiveObjects"
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.audit_archive[0].arn}/*"]
    }
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

  dynamic "statement" {
    for_each = var.alert_email != "" ? [1] : []

    content {
      sid       = "PublishOperationalAlerts"
      actions   = ["sns:Publish"]
      resources = [aws_sns_topic.operational_alerts[0].arn]
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
    SCHEDULED_IMPORT_PREFIXES      = join(",", var.scheduled_import_prefixes)
    AWS_S3_AUDIT_ARCHIVE_BUCKET    = var.enable_immutable_audit_archive ? aws_s3_bucket.audit_archive[0].bucket : ""
    RAW_FILE_RETENTION_DAYS        = tostring(var.raw_file_retention_days)
    AUDIT_ARCHIVE_RETENTION_DAYS   = tostring(var.audit_archive_retention_days)
    AUDIT_EVENT_RETENTION_DAYS     = "180"
    IMPORT_STATUS_RETENTION_DAYS   = "90"
    SIEM_HTTP_ENDPOINT             = var.siem_http_endpoint
    ALERT_SNS_TOPIC_ARN            = var.alert_email != "" ? aws_sns_topic.operational_alerts[0].arn : ""
    COGNITO_USER_POOL_ID           = var.enable_cognito_auth ? aws_cognito_user_pool.main[0].id : ""
    COGNITO_USER_POOL_CLIENT_ID    = var.enable_cognito_auth ? aws_cognito_user_pool_client.frontend[0].id : ""
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

resource "aws_cognito_user_pool" "main" {
  count = var.enable_cognito_auth ? 1 : 0

  name = "${local.name_prefix}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "frontend" {
  count = var.enable_cognito_auth ? 1 : 0

  name         = "${local.name_prefix}-frontend"
  user_pool_id = aws_cognito_user_pool.main[0].id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = var.cognito_callback_urls
  logout_urls                          = var.cognito_logout_urls
  supported_identity_providers         = ["COGNITO"]
  prevent_user_existence_errors        = "ENABLED"
  explicit_auth_flows                  = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  access_token_validity                = 60
  id_token_validity                    = 60
  refresh_token_validity               = 1

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  count = var.enable_cognito_auth ? 1 : 0

  domain       = local.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.main[0].id
}

resource "aws_cognito_user_group" "planner" {
  count = var.enable_cognito_auth ? 1 : 0

  name         = "planner"
  user_pool_id = aws_cognito_user_pool.main[0].id
  description  = "Can review, note, and dismiss planner actions."
  precedence   = 30
}

resource "aws_cognito_user_group" "approver" {
  count = var.enable_cognito_auth ? 1 : 0

  name         = "approver"
  user_pool_id = aws_cognito_user_pool.main[0].id
  description  = "Can approve planner actions."
  precedence   = 20
}

resource "aws_cognito_user_group" "admin" {
  count = var.enable_cognito_auth ? 1 : 0

  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main[0].id
  description  = "Can administer pilot access and clear review state."
  precedence   = 10
}

resource "aws_apigatewayv2_api" "http" {
  count = var.enable_cognito_auth ? 1 : 0

  name          = "${local.name_prefix}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = var.allowed_origins
    max_age           = 300
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  count = var.enable_cognito_auth ? 1 : 0

  api_id                 = aws_apigatewayv2_api.http[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  count = var.enable_cognito_auth ? 1 : 0

  api_id           = aws_apigatewayv2_api.http[0].id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name_prefix}-cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend[0].id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main[0].id}"
  }
}

resource "aws_apigatewayv2_route" "proxy" {
  count = var.enable_cognito_auth ? 1 : 0

  api_id             = aws_apigatewayv2_api.http[0].id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito[0].id
}

resource "aws_apigatewayv2_route" "root" {
  count = var.enable_cognito_auth ? 1 : 0

  api_id             = aws_apigatewayv2_api.http[0].id
  route_key          = "ANY /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito[0].id
}

resource "aws_apigatewayv2_stage" "default" {
  count = var.enable_cognito_auth ? 1 : 0

  api_id      = aws_apigatewayv2_api.http[0].id
  name        = "$default"
  auto_deploy = true
  tags        = local.common_tags
}

resource "aws_lambda_permission" "allow_api_gateway" {
  count = var.enable_cognito_auth ? 1 : 0

  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http[0].execution_arn}/*/*"
}

resource "aws_wafv2_web_acl" "api" {
  count = var.enable_api_waf && var.enable_cognito_auth ? 1 : 0

  name        = "${local.name_prefix}-api-waf"
  description = "StockSense AI Cognito auth WAF for buyer pilot hardening."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedCommonRules"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit_per_5_min
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = length(var.waf_blocked_country_codes) > 0 ? [1] : []

    content {
      name     = "GeoBlock"
      priority = 3

      action {
        block {}
      }

      statement {
        geo_match_statement {
          country_codes = var.waf_blocked_country_codes
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.name_prefix}-geo-block"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

resource "aws_wafv2_web_acl_association" "cognito" {
  count = var.enable_api_waf && var.enable_cognito_auth ? 1 : 0

  resource_arn = aws_cognito_user_pool.main[0].arn
  web_acl_arn  = aws_wafv2_web_acl.api[0].arn
}

resource "aws_sns_topic" "operational_alerts" {
  count = var.alert_email != "" ? 1 : 0

  name = "${local.name_prefix}-operational-alerts"
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "operational_alert_email" {
  count = var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.operational_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
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

data "aws_iam_policy_document" "transfer_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["transfer.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "transfer_user" {
  count              = var.enable_managed_sftp ? 1 : 0
  name               = "${local.name_prefix}-sftp-user"
  assume_role_policy = data.aws_iam_policy_document.transfer_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "transfer_user_access" {
  count = var.enable_managed_sftp ? 1 : 0

  statement {
    sid       = "ListRawImportBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.raw_imports.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["inventory-ai/raw-imports/sftp/*"]
    }
  }

  statement {
    sid = "WriteSftpLandingPrefix"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = ["${aws_s3_bucket.raw_imports.arn}/inventory-ai/raw-imports/sftp/*"]
  }
}

resource "aws_iam_role_policy" "transfer_user_access" {
  count  = var.enable_managed_sftp ? 1 : 0
  name   = "${local.name_prefix}-sftp-user-access"
  role   = aws_iam_role.transfer_user[0].id
  policy = data.aws_iam_policy_document.transfer_user_access[0].json
}

resource "aws_transfer_server" "sftp" {
  count = var.enable_managed_sftp ? 1 : 0

  protocols              = ["SFTP"]
  identity_provider_type = "SERVICE_MANAGED"
  endpoint_type          = "PUBLIC"
  tags                   = local.common_tags
}

resource "aws_transfer_user" "sftp" {
  count = var.enable_managed_sftp ? 1 : 0

  server_id           = aws_transfer_server.sftp[0].id
  user_name           = var.sftp_user_name
  role                = aws_iam_role.transfer_user[0].arn
  home_directory_type = "LOGICAL"

  home_directory_mappings {
    entry  = "/"
    target = "/${aws_s3_bucket.raw_imports.bucket}/inventory-ai/raw-imports/sftp"
  }
}

resource "aws_transfer_ssh_key" "sftp" {
  count = var.enable_managed_sftp && var.sftp_public_key != "" ? 1 : 0

  server_id = aws_transfer_server.sftp[0].id
  user_name = aws_transfer_user.sftp[0].user_name
  body      = var.sftp_public_key
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

data "aws_iam_policy_document" "import_scheduler_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "import_scheduler" {
  count              = var.enable_scheduled_import_scan ? 1 : 0
  name               = "${local.name_prefix}-import-scheduler"
  assume_role_policy = data.aws_iam_policy_document.import_scheduler_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "import_scheduler_invoke" {
  count = var.enable_scheduled_import_scan ? 1 : 0

  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.import_worker.arn]
  }
}

resource "aws_iam_role_policy" "import_scheduler_invoke" {
  count  = var.enable_scheduled_import_scan ? 1 : 0
  name   = "${local.name_prefix}-import-scheduler-invoke"
  role   = aws_iam_role.import_scheduler[0].id
  policy = data.aws_iam_policy_document.import_scheduler_invoke[0].json
}

resource "aws_scheduler_schedule" "import_scan" {
  count = var.enable_scheduled_import_scan ? 1 : 0

  name                = "${local.name_prefix}-import-scan"
  description         = "Periodic StockSense AI S3/SFTP landing-prefix import scan."
  schedule_expression = var.scheduled_import_schedule_expression

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.import_worker.arn
    role_arn = aws_iam_role.import_scheduler[0].arn
    input    = jsonencode({ source = "stocksense.scheduled_import_scan" })
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
