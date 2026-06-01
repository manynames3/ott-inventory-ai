output "api_function_url" {
  description = "Lambda Function URL for NEXT_PUBLIC_API_BASE_URL."
  value       = aws_lambda_function_url.api.function_url
}

output "raw_import_bucket" {
  description = "Private S3 bucket for raw Excel/CSV uploads."
  value       = aws_s3_bucket.raw_imports.bucket
}

output "raw_import_prefix" {
  description = "S3 prefix watched by the import worker Lambda."
  value       = var.raw_import_prefix
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
