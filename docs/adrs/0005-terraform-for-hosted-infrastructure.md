# ADR 0005: Manage Hosted Infrastructure With Terraform

## Status

Accepted

## Context

The project needs repeatable low-idle AWS infrastructure and should avoid manual console drift. The user also requested Terraform instead of CloudFormation.

## Decision

Use Terraform in `infra/terraform` to provision S3, DynamoDB, Lambda functions, Lambda Function URL, S3 notifications, optional EventBridge Scheduler, IAM permissions, and optional AWS Budget alerts.

## Consequences

- Infrastructure is documented, reviewable, and reproducible.
- Lambda code packaging is handled through Terraform archive data sources.
- AWS credentials and environment-specific values still need to be managed outside source control.
- More production-grade environments can be added later with separate variable files or workspaces.
