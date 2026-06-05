# Retention, Audit Export, And SIEM Plan

## Default Pilot Retention

| Data class | Default retention | Storage path |
| --- | ---: | --- |
| Raw uploaded CSV/XLSX files | 365 days | Private S3 raw import bucket |
| Import status and validation history | 90 days | DynamoDB imports table TTL |
| App audit events | 180 days | DynamoDB imports/audit partition TTL |
| Immutable audit archive | 2,555 days | S3 Object Lock bucket, when enabled |

## Immutable Audit Export

When `enable_immutable_audit_archive=true`, the API writes audit events to an S3 bucket with Object Lock default retention. Events are partitioned by tenant and date:

```text
tenant=<tenant_id>/year=<yyyy>/month=<mm>/day=<dd>/<timestamp>-<uuid>.json
```

The archive is append-only for the pilot use case and is suitable for buyer review, downstream SIEM ingestion, and weekly pilot governance.

## SIEM Integration Options

1. S3 pull ingestion: buyer SIEM reads the immutable audit archive using a scoped IAM role.
2. S3 event forwarding: buyer receives S3 ObjectCreated events through EventBridge or a Lambda forwarder.
3. HTTP collector: StockSense forwards audit events to a buyer-approved HTTPS endpoint.

The default Terraform variable `siem_http_endpoint` is intentionally documentation-only until the buyer provides endpoint auth, payload schema, retry requirements, and retention terms.

## Alerting

The low-idle pilot supports SNS email alerts for:

- API errors
- Import preview/commit failures
- Import worker failures
- Slow jobs or slow requests
- Failed AI calls that fell back to rule-based answers

## Review Questions

- Does the buyer require immutable audit export for the pilot, or only for production rollout?
- Which SIEM product owns ingestion: Splunk, Datadog, Microsoft Sentinel, Chronicle, or another tool?
- Should raw uploads be deleted at pilot end, retained for backtesting, or returned to the buyer?
- Does the buyer need legal hold or deletion exceptions?
- Who receives operational alerts during the pilot?
