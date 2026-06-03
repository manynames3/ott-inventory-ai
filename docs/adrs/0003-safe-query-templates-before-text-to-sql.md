# ADR 0003: Use Safe Query Templates Before Text-to-SQL

## Status

Accepted

## Context

The app needs natural-language inventory questions, but arbitrary text-to-SQL can create security, cost, correctness, and data-access risks. The most important pilot questions are known: stockouts, expiring inventory, reorder actions, customer reorder cadence, and recurring SKU buyers.

## Decision

Map natural-language questions to curated safe templates and materialized views. Optionally use OpenAI only to improve explanations, action bullets, risk notes, and confidence notes over the matched safe view. The model does not generate SQL or choose tables.

## Consequences

- Query behavior is predictable, bounded, and easier to test.
- Unsupported questions return safe guidance instead of attempting risky database access.
- The AI layer can be disabled or fall back deterministically when no key is configured.
- Future versions can add permissioned text-to-SQL with row limits, audit logging, and query review if needed.
