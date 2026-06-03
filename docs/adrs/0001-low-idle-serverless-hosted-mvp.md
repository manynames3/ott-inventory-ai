# ADR 0001: Use A Low-Idle Serverless Hosted MVP

## Status

Accepted

## Context

The MVP needs to be usable by a low-traffic pilot buyer without creating a high monthly infrastructure floor. Always-on services such as ECS Fargate, App Runner, RDS, Aurora, an Application Load Balancer, or NAT Gateway can cost more at idle than the first pilot justifies.

## Decision

Use Cloudflare Pages for the static frontend and AWS Lambda Function URL, S3, DynamoDB on-demand, S3 events, optional EventBridge Scheduler, and SSM Parameter Store for the hosted backend path.

## Consequences

- Idle cost stays low because compute runs primarily on requests, uploads, or schedules.
- DynamoDB access patterns and materialized views must be designed up front.
- The local FastAPI/PostgreSQL path remains useful for relational development and future paid-pilot deployments.
- A production pilot may later add API Gateway, WAF, stronger identity, observability, and a relational database if usage justifies the cost.
