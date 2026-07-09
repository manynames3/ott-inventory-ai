"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, ListChecks, ShieldCheck } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { PageLoading } from "@/components/feedback";
import { MetricCard } from "@/components/metric-card";
import {
  ActionReviewRow,
  ActionReviewsResponse,
  DashboardResponse,
  apiGet,
  formatCurrency,
  formatNumber,
} from "@/lib/api";

type ReportState = {
  dashboard: DashboardResponse | null;
  reviews: ActionReviewRow[];
  loading: boolean;
  error: string | null;
};

function parseCurrency(value: unknown): number {
  if (typeof value === "number") return value;
  const numeric = String(value ?? "").replace(/[^0-9.-]/g, "");
  return numeric ? Number(numeric) : 0;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reviewValue(row: ActionReviewRow): number {
  const snapshot = row.action_snapshot || {};
  return parseCurrency(snapshot.financial_impact ?? snapshot.at_risk_value ?? snapshot.estimated_order_value);
}

function reviewType(row: ActionReviewRow): string {
  return String(row.action_snapshot?.action_type || "Planner action");
}

function reviewSku(row: ActionReviewRow): string {
  return String(row.action_snapshot?.sku || "");
}

function reviewProduct(row: ActionReviewRow): string {
  return String(row.action_snapshot?.product_name || "");
}

function downloadWeeklyRoiCsv(rows: ActionReviewRow[]) {
  const columns = [
    "status",
    "action_type",
    "sku",
    "product_name",
    "financial_impact",
    "note",
    "updated_by",
    "approved_by",
    "approved_at",
  ];
  const body = rows
    .map((row) =>
      [
        row.status,
        reviewType(row),
        reviewSku(row),
        reviewProduct(row),
        reviewValue(row),
        row.note,
        row.updated_by,
        row.approved_by,
        row.approved_at || row.approved_at_epoch,
      ]
        .map(escapeCsv)
        .join(",")
    )
    .join("\n");
  const csv = `${columns.join(",")}\n${body}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stocksense-weekly-reviewed-actions.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [state, setState] = useState<ReportState>({ dashboard: null, reviews: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    Promise.all([apiGet<DashboardResponse>("/api/dashboard"), apiGet<ActionReviewsResponse>("/api/action-reviews")])
      .then(([dashboard, reviews]) => {
        if (active) setState({ dashboard, reviews: reviews.rows || [], loading: false, error: null });
      })
      .catch((error) => {
        if (active) {
          setState({
            dashboard: null,
            reviews: [],
            loading: false,
            error: error instanceof Error ? error.message : "Report data unavailable",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const reviewed = state.reviews.filter((row) => row.status === "accepted" || row.status === "dismissed");
  const accepted = state.reviews.filter((row) => row.status === "accepted");
  const dismissed = state.reviews.filter((row) => row.status === "dismissed");
  const acceptedValue = accepted.reduce((sum, row) => sum + reviewValue(row), 0);
  const dismissedValue = dismissed.reduce((sum, row) => sum + reviewValue(row), 0);
  const wasteProtected = accepted
    .filter((row) => reviewType(row).toLowerCase().includes("waste"))
    .reduce((sum, row) => sum + reviewValue(row), 0);
  const fillRateProtected = accepted
    .filter((row) => reviewType(row).toLowerCase().includes("fill") || reviewType(row).toLowerCase().includes("reorder"))
    .reduce((sum, row) => sum + reviewValue(row), 0);

  const rows = useMemo(
    () =>
      reviewed.map((row) => ({
        status: row.status === "accepted" ? "approved" : "dismissed",
        action_type: reviewType(row),
        sku: reviewSku(row),
        product_name: reviewProduct(row),
        financial_impact: formatCurrency(reviewValue(row)),
        note: row.note || "No note",
        approver: row.approved_by || row.updated_by || "unassigned",
      })),
    [reviewed]
  );

  if (state.loading) {
    return <PageLoading label="Loading weekly operations report" />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Weekly Action Report</h1>
          <p>Approved and dismissed planner decisions summarized for the weekly operations review.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/actions">
            <ListChecks size={17} />
            Review actions
          </Link>
          <button className="button" type="button" onClick={() => downloadWeeklyRoiCsv(reviewed)} disabled={!reviewed.length}>
            <Download size={17} />
            Download CSV
          </button>
        </div>
      </header>

      {state.error ? <div className="message error" role="alert">{state.error}</div> : null}

      <section className="metrics-grid">
        <MetricCard label="Approved opportunity value" value={formatCurrency(acceptedValue)} tone="value" />
        <MetricCard label="Waste opportunity approved" value={formatCurrency(wasteProtected)} tone="waste" />
        <MetricCard label="Fill-rate opportunity approved" value={formatCurrency(fillRateProtected)} tone="stockout" />
        <MetricCard label="Dismissed opportunity value" value={formatCurrency(dismissedValue)} tone="risk" />
        <MetricCard label="Reviewed actions" value={formatNumber(reviewed.length)} tone="reorder" />
      </section>
      <p className="metrics-helper">
        This report uses actual planner review status and notes. Dashboard opportunity remains visible for comparison:
        {" "}
        {formatCurrency(state.dashboard?.kpis.waste_reduction_opportunity || 0)} recoverable before expiry.
      </p>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Operations Summary</h2>
              <p>Use this section in the weekly operations review.</p>
            </div>
          </div>
          <div className="security-list">
            <div>
              <ShieldCheck size={18} />
              <p>
                {accepted.length.toLocaleString()} actions approved, {dismissed.length.toLocaleString()} dismissed, and{" "}
                {state.reviews.filter((row) => row.status === "open").length.toLocaleString()} still open.
              </p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>
                Approved opportunity value totals {formatCurrency(acceptedValue)} across reorder, allocation, FEFO, and waste-risk decisions. Confirm realized value downstream.
              </p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>Dismissed actions remain valuable: they document planner overrides and prevent the model from becoming a black box.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Report Controls</h2>
              <p>Recommendations stay decision support only. No ERP or WMS record is changed by approving an action.</p>
            </div>
          </div>
          <div className="contract-list">
            <div>
              <strong>Attribution</strong>
              <p>Rows include updated-by and approved-by fields from the active review store.</p>
            </div>
            <div>
              <strong>Scope</strong>
              <p>Financial impact is pulled from each action snapshot; missing values are treated as zero.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Reviewed Action Ledger</h2>
            <p>Approved and dismissed decisions that back the weekly ROI report.</p>
          </div>
        </div>
        <DataTable
          columns={["status", "action_type", "sku", "product_name", "financial_impact", "note", "approver"]}
          rows={rows}
          emptyLabel="Approve or dismiss planner actions to generate a weekly ROI report."
        />
      </section>
    </>
  );
}
