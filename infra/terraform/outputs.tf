output "api_function_url" {
  description = "Lambda Function URL for NEXT_PUBLIC_API_BASE_URL."
  value       = aws_lambda_function_url.api.function_url
}

output "api_gateway_url" {
  description = "Cognito-protected API Gateway URL for NEXT_PUBLIC_API_BASE_URL when enable_cognito_auth is true."
  value       = try(aws_apigatewayv2_api.http[0].api_endpoint, null)
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID when enable_cognito_auth is true."
  value       = try(aws_cognito_user_pool.main[0].id, null)
}

output "cognito_user_pool_client_id" {
  description = "Cognito frontend app client ID for NEXT_PUBLIC_COGNITO_CLIENT_ID."
  value       = try(aws_cognito_user_pool_client.frontend[0].id, null)
}

output "cognito_domain" {
  description = "Cognito Hosted UI domain for NEXT_PUBLIC_COGNITO_DOMAIN."
  value       = try("https://${aws_cognito_user_pool_domain.main[0].domain}.auth.${var.aws_region}.amazoncognito.com", null)
}

output "raw_import_bucket" {
  description = "Private S3 bucket for raw Excel/CSV uploads."
  value       = aws_s3_bucket.raw_imports.bucket
}

output "raw_import_prefix" {
  description = "S3 prefix watched by the import worker Lambda."
  value       = var.raw_import_prefix
}

output "scheduled_import_prefixes" {
  description = "S3 prefixes scanned by the scheduled import worker."
  value       = var.scheduled_import_prefixes
}

output "audit_archive_bucket" {
  description = "Immutable S3 audit archive bucket when enabled."
  value       = try(aws_s3_bucket.audit_archive[0].bucket, null)
}

output "operational_alert_topic_arn" {
  description = "SNS topic ARN for operational alerts when alert_email is configured."
  value       = try(aws_sns_topic.operational_alerts[0].arn, null)
}

output "api_waf_web_acl_arn" {
  description = "AWS WAF web ACL ARN attached to the Cognito auth path when enable_api_waf and enable_cognito_auth are true."
  value       = try(aws_wafv2_web_acl.api[0].arn, null)
}

output "managed_sftp_endpoint" {
  description = "AWS Transfer Family SFTP endpoint when enable_managed_sftp is true."
  value       = try(aws_transfer_server.sftp[0].endpoint, null)
}

output "managed_sftp_landing_prefix" {
  description = "S3 landing prefix used by the optional managed SFTP user."
  value       = "inventory-ai/raw-imports/sftp/"
}

output "records_table_name" {
  description = "DynamoDB table for canonical records."
  value       = aws_dynamodb_table.records.name
}

output "views_table_name" {
  description = "DynamoDB table for materialized dashboard and query views."
  value       = aws_dynamodb_table.views.name
}

output "imports_table_name" {
  description = "DynamoDB table for import status and validation results."
  value       = aws_dynamodb_table.imports.name
}

output "api_lambda_name" {
  description = "API Lambda function name."
  value       = aws_lambda_function.api.function_name
}

output "import_worker_lambda_name" {
  description = "S3-triggered import worker Lambda function name."
  value       = aws_lambda_function.import_worker.function_name
}

output "refresh_worker_lambda_name" {
  description = "Recommendation refresh worker Lambda function name."
  value       = aws_lambda_function.refresh_worker.function_name
}

output "budget_name" {
  description = "AWS Budget name, when enabled."
  value       = try(aws_budgets_budget.monthly[0].name, null)
}
