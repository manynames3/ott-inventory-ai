variable "aws_region" {
  description = "AWS region for the low-idle MVP resources."
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Short project name used in resource names."
  type        = string
  default     = "ott-inventory-ai"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "mvp"
}

variable "allowed_origins" {
  description = "Frontend origins allowed to call the Lambda Function URL and S3 upload endpoint."
  type        = list(string)
  default = [
    "https://ott-inventory-ai.pages.dev",
    "http://localhost:3000"
  ]
}

variable "raw_import_bucket_name" {
  description = "Optional globally unique S3 bucket name. Leave empty to derive one from account, region, and environment."
  type        = string
  default     = ""
}

variable "raw_import_prefix" {
  description = "S3 prefix for raw incoming Excel/CSV uploads."
  type        = string
  default     = "inventory-ai/raw-imports/incoming/"
}

variable "raw_file_retention_days" {
  description = "Days to retain raw uploaded files. Set to 0 to disable lifecycle expiration."
  type        = number
  default     = 365
}

variable "lambda_runtime" {
  description = "Python Lambda runtime."
  type        = string
  default     = "python3.12"
}

variable "api_lambda_memory_mb" {
  description = "Memory size for the API Lambda."
  type        = number
  default     = 512
}

variable "job_lambda_memory_mb" {
  description = "Memory size for import and refresh job Lambdas."
  type        = number
  default     = 1024
}

variable "api_lambda_timeout_seconds" {
  description = "Timeout for the API Lambda."
  type        = number
  default     = 30
}

variable "job_lambda_timeout_seconds" {
  description = "Timeout for import and refresh job Lambdas."
  type        = number
  default     = 300
}

variable "reserved_concurrency" {
  description = "Reserved concurrency cap per Lambda to avoid surprise costs. Keep -1 when the AWS account quota cannot support reservations."
  type        = number
  default     = -1
}

variable "enable_refresh_schedule" {
  description = "Whether to create an EventBridge Scheduler rule for periodic recommendation refreshes."
  type        = bool
  default     = false
}

variable "refresh_schedule_expression" {
  description = "EventBridge Scheduler expression used when enable_refresh_schedule is true."
  type        = string
  default     = "rate(1 day)"
}

variable "enable_budget" {
  description = "Whether to create an AWS monthly cost budget."
  type        = bool
  default     = true
}

variable "budget_email" {
  description = "Email address for budget alerts. Leave empty to skip the budget resource."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly budget threshold in USD."
  type        = number
  default     = 10
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB point-in-time recovery. Useful for real pilots, but has cost implications."
  type        = bool
  default     = false
}

variable "auth_username_parameter_name" {
  description = "Optional SSM parameter name for the MVP login username."
  type        = string
  default     = "/inventory-ai/mvp/auth/username"
}

variable "auth_password_parameter_name" {
  description = "Optional SSM parameter name for the MVP login password."
  type        = string
  default     = "/inventory-ai/mvp/auth/password"
}

variable "auth_secret_key_parameter_name" {
  description = "Optional SSM parameter name for the bearer-token signing secret."
  type        = string
  default     = "/inventory-ai/mvp/auth/secret-key"
}

variable "tags" {
  description = "Additional tags to apply to supported resources."
  type        = map(string)
  default     = {}
}
