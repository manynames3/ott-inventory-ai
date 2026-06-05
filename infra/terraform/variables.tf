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

variable "tenant_id" {
  description = "Logical tenant partition id used by the hosted MVP data store."
  type        = string
  default     = "default"
}

variable "allowed_origins" {
  description = "Frontend origins allowed to call the Lambda Function URL and S3 upload endpoint."
  type        = list(string)
  default = [
    "https://otokistocksense.pages.dev",
    "https://ott-inventory-ai.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
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

variable "enable_scheduled_import_scan" {
  description = "Whether to create an EventBridge Scheduler rule that scans S3 landing prefixes for scheduled imports."
  type        = bool
  default     = false
}

variable "scheduled_import_schedule_expression" {
  description = "EventBridge Scheduler expression for scheduled S3 import scans."
  type        = string
  default     = "rate(1 hour)"
}

variable "scheduled_import_prefixes" {
  description = "S3 prefixes scanned by the import worker for scheduled or SFTP-landed files."
  type        = list(string)
  default = [
    "inventory-ai/raw-imports/scheduled/",
    "inventory-ai/raw-imports/sftp/"
  ]
}

variable "enable_managed_sftp" {
  description = "Create a native AWS Transfer Family SFTP server for enterprise pilots. Disabled by default because it has fixed monthly cost."
  type        = bool
  default     = false
}

variable "sftp_user_name" {
  description = "Service-managed AWS Transfer Family user name when enable_managed_sftp is true."
  type        = string
  default     = "stocksense-sftp"
}

variable "sftp_public_key" {
  description = "SSH public key for the Transfer Family SFTP user. Leave empty to create the server without a user key."
  type        = string
  default     = ""
}

variable "enable_api_waf" {
  description = "Create an AWS WAF web ACL for the Cognito Hosted UI/auth path. API Gateway v2 HTTP APIs do not support direct regional WAF association."
  type        = bool
  default     = false
}

variable "waf_rate_limit_per_5_min" {
  description = "WAF rate limit per IP over 5 minutes."
  type        = number
  default     = 1000
}

variable "waf_blocked_country_codes" {
  description = "Optional ISO country codes to block at WAF. Leave empty for no geo block."
  type        = list(string)
  default     = []
}

variable "siem_http_endpoint" {
  description = "Optional SIEM HTTP endpoint placeholder for security review documentation. Runtime forwarding is intentionally not enabled without a customer-approved secret."
  type        = string
  default     = ""
}

variable "enable_cognito_auth" {
  description = "Create Cognito User Pool and API Gateway JWT authorizer for SSO-ready pilot auth."
  type        = bool
  default     = false
}

variable "cognito_domain_prefix" {
  description = "Optional Cognito Hosted UI domain prefix. Leave empty to derive one from project and environment."
  type        = string
  default     = ""
}

variable "cognito_callback_urls" {
  description = "Allowed Cognito OAuth callback URLs."
  type        = list(string)
  default = [
    "https://otokistocksense.pages.dev/login",
    "http://localhost:3000/login"
  ]
}

variable "cognito_logout_urls" {
  description = "Allowed Cognito OAuth logout URLs."
  type        = list(string)
  default = [
    "https://otokistocksense.pages.dev/login",
    "http://localhost:3000/login"
  ]
}

variable "alert_email" {
  description = "Optional email for operational alerts. Leave empty to skip SNS alert subscription."
  type        = string
  default     = ""
}

variable "enable_immutable_audit_archive" {
  description = "Create an S3 Object Lock bucket and write append-only audit events to it."
  type        = bool
  default     = false
}

variable "audit_archive_bucket_name" {
  description = "Optional globally unique immutable audit archive bucket name."
  type        = string
  default     = ""
}

variable "audit_archive_retention_days" {
  description = "Default Object Lock retention for audit archive objects."
  type        = number
  default     = 2555
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

variable "auth_role" {
  description = "Fallback role for the single-user auth mode. Use viewer, planner, approver, or admin."
  type        = string
  default     = "approver"
}

variable "auth_users_json_parameter_name" {
  description = "Optional SSM SecureString parameter containing a JSON object of pilot users with password and role fields."
  type        = string
  default     = "/inventory-ai/mvp/auth/users-json"
}

variable "openai_api_key_parameter_name" {
  description = "Optional SSM parameter name for the OpenAI API key used by the AI query layer. Leave empty to force rule-based fallback."
  type        = string
  default     = "/inventory-ai/mvp/openai/api-key"
}

variable "openai_model" {
  description = "OpenAI model used for low-cost query explanation and action summarization."
  type        = string
  default     = "gpt-5-mini"
}

variable "ai_query_enabled" {
  description = "Enable LLM augmentation for safe materialized query views when the OpenAI key is configured."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to supported resources."
  type        = map(string)
  default     = {}
}
