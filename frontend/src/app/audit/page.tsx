"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { PageLoading } from "@/components/feedback";
import { MetricCard } from "@/components/metric-card";
import {
  ActionReviewsResponse,
  AuditEventRow,
  AuditEventsResponse,
  apiGet
} from "@/lib/api";

type LoadState = {
  audit: AuditEventsResponse | null;
  reviews: ActionReviewsResponse | null;
  loading: boolean;
  error: string | null;
};

function formatEpoch(epoch?: number) {
  if (!epoch || Number.isNaN(epoch)) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(epoch * 1000);
}

function formatIso(value?: string) {
  if (!value) return "-";
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : formatEpoch(Math.floor(timestamp / 1000));
}

function detailsText(details?: Record<string, unknown>) {
  if (!details || !Object.keys(details).length) return "";
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

function csvValue(value: unknown): string {
  const output = value === null || value === undefined || value === "" ? "-" : String(value);
  const escaped = output.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function actionLabel(action?: string) {
  return (action || "event").replaceAll("_", " ");
}

function formatAuditRows(rows: AuditEventRow[]) {
  return rows.map((row) => ({
    time: formatEpoch(row.created_at_epoch),
    user: row.user || "-",
    action: actionLabel(row.action),
    resource: row.resource || "-",
    origin: row.origin || "-",
    details: detailsText(row.details)
  }));
}

function formatReviewRows(rows: ActionReviewsResponse["rows"]) {
  return rows.map((row) => {
    const snapshot = row.action_snapshot || {};
    const updatedAt = row.updated_at || (row.updated_at_epoch ? new Date(row.updated_at_epoch * 1000).toISOString() : "");
    const approvedAt = row.approved_at || (row.approved_at_epoch ? new Date(row.approved_at_epoch * 1000).toISOString() : "");
    return {
      status: row.status === "accepted" ? "approved" : row.status,
      sku: snapshot.sku || "-",
      action_type: snapshot.action_type || "-",
      warehouse: snapshot.warehouse || "-",
      note: row.note || "-",
      updated_by: row.updated_by || "-",
      updated_at: formatIso(updatedAt),
      approved_by: row.approved_by || "-",
      approved_at: formatIso(approvedAt)
    };
  });
}

export default function AuditPage() {
  const [state, setState] = useState<LoadState>({ audit: null, reviews: null, loading: true, error: null });

  async function loadAudit() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [audit, reviews] = await Promise.all([
        apiGet<AuditEventsResponse>("/api/audit-events?limit=150"),
        apiGet<ActionReviewsResponse>("/api/action-reviews")
      ]);
      setState({ audit, reviews, loading: false, error: null });
    } catch (err) {
      setState((current) => ({
        ...current,
        loading: false,
        error: err instanceof Error ? err.message : "Audit trail is unavailable."
      }));
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  const auditRows = useMemo(() => formatAuditRows(state.audit?.rows || []), [state.audit]);
  const reviewRows = useMemo(() => formatReviewRows(state.reviews?.rows || []), [state.reviews]);
  const approvalCount = reviewRows.filter((row) => row.status === "approved").length;
  const importEventCount = (state.audit?.rows || []).filter((row) => String(row.action || "").startsWith("import_")).length;
  const queryEventCount = (state.audit?.rows || []).filter((row) => row.action === "query_answered").length;
  const failureCount = (state.audit?.rows || []).filter((row) => /failed|failure|error/.test(String(row.action || ""))).length;

  function downloadAuditCsv() {
    const columns = ["time", "user", "action", "resource", "origin", "details"];
    const csv = [
      columns.join(","),
      ...auditRows.map((row) => columns.map((column) => csvValue(row[column as keyof typeof row])).join(","))
    ].join("\n");
    const blob = new Blob([`${csv}\n`], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stocksense_audit_events.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  }

  if (state.loading && !state.audit && !state.reviews) return <PageLoading label="Loading audit trail" />;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Audit Trail</h1>
          <p>Trace login, import, query, export, and planner-review activity for this workspace.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/imports">
            <UploadCloud size={17} />
            Imports
          </Link>
          <button className="button secondary" type="button" onClick={loadAudit} disabled={state.loading}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="button" type="button" onClick={downloadAuditCsv} disabled={!auditRows.length}>
            <Download size={17} />
            Export audit CSV
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Audit events loaded" value={(state.audit?.count || 0).toLocaleString()} tone="value" />
        <MetricCard label="Import events" value={importEventCount.toLocaleString()} tone="reorder" />
        <MetricCard label="Query events" value={queryEventCount.toLocaleString()} tone="stockout" />
        <MetricCard label="Approved actions" value={approvalCount.toLocaleString()} tone="waste" />
        <MetricCard label="Failure events" value={failureCount.toLocaleString()} tone={failureCount ? "risk" : "value"} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Control Evidence</h2>
            <p>
              This audit view shows who touched data and recommendations, while StockSense AI
              remains read-only against ERP/WMS.
            </p>
          </div>
          <span className="audit-badge">
            <ShieldCheck size={16} />
            No ERP writeback
          </span>
        </div>
        {state.error ? <div className="message error" role="alert">{state.error}</div> : null}
        {state.loading ? <div className="empty-state">Loading audit trail</div> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Audit Events</h2>
            <p>Login, upload, import, export, query, monitoring, and approval events from the active backend.</p>
          </div>
        </div>
        <DataTable
          columns={["time", "user", "action", "resource", "origin", "details"]}
          rows={auditRows}
          emptyLabel={state.loading ? "Loading audit events" : "No audit events yet"}
          tableClassName="audit-events-table"
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Planner Review Evidence</h2>
            <p>Current review state for recommended actions, including notes and approval attribution.</p>
          </div>
          <Link className="button secondary" href="/actions">
            Review actions
          </Link>
        </div>
        <DataTable
          columns={["status", "sku", "action_type", "warehouse", "note", "updated_by", "updated_at", "approved_by", "approved_at"]}
          rows={reviewRows}
          emptyLabel={state.loading ? "Loading planner reviews" : "No reviewed actions yet"}
          tableClassName="audit-reviews-table"
        />
      </section>
    </>
  );
}
