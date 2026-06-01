"use client";

import Link from "next/link";
import { BadgeDollarSign, Clock3, Download, PackageCheck, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { BarChart, MultiLineChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { apiGet, DashboardResponse, formatCurrency, formatNumber, TableResponse } from "@/lib/api";

type DashboardState = {
  dashboard: DashboardResponse | null;
  products: TableResponse;
  customers: TableResponse;
  error: string | null;
  loading: boolean;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportRows(rows: Record<string, unknown>[], columns: string[]) {
  if (!rows.length) {
    return '<p class="empty">No rows in this section.</p>';
  }
  return `<table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.replaceAll("_", " "))}</th>`).join("")}</tr></thead><tbody>${rows
    .slice(0, 12)
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column])}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody></table>`;
}

function downloadExecutiveReport(dashboard: DashboardResponse) {
  const generatedAt = new Date().toLocaleString("en-US");
  const stockoutActions = dashboard.recommendations.filter((row) => String(row.status || "").includes("stockout")).length;
  const riskShare = dashboard.kpis.total_inventory_value
    ? Math.round((dashboard.kpis.inventory_at_risk_value / dashboard.kpis.total_inventory_value) * 1000) / 10
    : 0;
  const plannerHours = Math.max(
    2,
    Math.round((dashboard.recommendations.length + dashboard.waste_risk_alerts.length + dashboard.fefo.length) * 0.2)
  );
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Inventory AI Executive ROI Report</title>
  <style>
    body { color: #1e2521; font-family: Arial, Helvetica, sans-serif; margin: 40px; line-height: 1.45; }
    h1 { font-size: 34px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin-top: 30px; }
    .muted { color: #66736d; }
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 24px 0; }
    .metric { border: 1px solid #dfe5df; border-radius: 8px; padding: 14px; }
    .metric span { color: #66736d; display: block; font-size: 12px; margin-bottom: 8px; }
    .metric strong { display: block; font-size: 22px; }
    table { border-collapse: collapse; margin-top: 12px; width: 100%; font-size: 12px; }
    th, td { border-bottom: 1px solid #dfe5df; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #66736d; text-transform: capitalize; }
    .callout { background: #f5f6f3; border: 1px solid #dfe5df; border-radius: 8px; padding: 16px; }
    .empty { color: #66736d; }
    @media print { body { margin: 22px; } .grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <h1>Inventory AI Executive ROI Report</h1>
  <p class="muted">Generated ${escapeHtml(generatedAt)} from the current pilot dataset.</p>
  <div class="callout">
    <strong>Executive readout:</strong>
    ${escapeHtml(formatCurrency(dashboard.kpis.inventory_at_risk_value))} of inventory is currently at expiration risk (${riskShare}% of inventory value), ${escapeHtml(
      String(stockoutActions)
    )} replenishment actions are flagged as stockout exposure, and approximately ${escapeHtml(
      String(plannerHours)
    )} planner triage hours are being concentrated into a prioritized exception queue.
  </div>
  <div class="grid">
    <div class="metric"><span>Total inventory value</span><strong>${escapeHtml(
      formatCurrency(dashboard.kpis.total_inventory_value)
    )}</strong></div>
    <div class="metric"><span>Expiration-risk value</span><strong>${escapeHtml(
      formatCurrency(dashboard.kpis.inventory_at_risk_value)
    )}</strong></div>
    <div class="metric"><span>Projected stockouts</span><strong>${escapeHtml(
      formatNumber(dashboard.kpis.projected_stockouts)
    )}</strong></div>
    <div class="metric"><span>Recommended reorder value</span><strong>${escapeHtml(
      formatCurrency(dashboard.kpis.recommended_reorder_value)
    )}</strong></div>
    <div class="metric"><span>Recoverable waste opportunity</span><strong>${escapeHtml(
      formatCurrency(dashboard.kpis.waste_reduction_opportunity)
    )}</strong></div>
  </div>
  <h2>What To Reorder This Week</h2>
  ${reportRows(dashboard.recommendations, ["sku", "warehouse", "status", "recommended_order_qty", "reorder_by_date", "reason"])}
  <h2>What To Ship First</h2>
  ${reportRows(dashboard.fefo, ["sku", "warehouse", "ship_first_lot", "expiration_date", "risk_bucket", "reason"])}
  <h2>Waste-Risk Actions</h2>
  ${reportRows(dashboard.waste_risk_alerts, ["sku", "lot_id", "warehouse", "quantity_at_risk", "expiration_date", "suggested_action"])}
  <p class="muted">Assumptions: pilot calculations use current on-hand inventory, inbound ETAs, historical order demand, expiration windows, safety stock, and configured supplier lead time. Recommendations are decision support, not ERP writeback.</p>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-ai-executive-roi-report.html";
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    dashboard: null,
    products: { rows: [] },
    customers: { rows: [] },
    error: null,
    loading: true
  });

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [dashboard, products, customers] = await Promise.all([
          apiGet<DashboardResponse>("/api/dashboard"),
          apiGet<TableResponse>("/api/products?limit=8"),
          apiGet<TableResponse>("/api/customers?limit=8")
        ]);
        if (active) {
          setState({ dashboard, products, customers, error: null, loading: false });
        }
      } catch (error) {
        if (active) {
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "API unavailable",
            loading: false
          }));
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <section className="panel">
        <div className="empty-state">Loading inventory dashboard</div>
      </section>
    );
  }

  if (!state.dashboard) {
    return (
      <>
        <header className="page-header">
          <div>
            <h1>Inventory AI</h1>
            <p>Backend API is not reachable.</p>
          </div>
        </header>
        <section className="panel">
          <div className="message error">{state.error}</div>
        </section>
      </>
    );
  }

  const dashboard = state.dashboard;
  const riskShare = dashboard.kpis.total_inventory_value
    ? Math.round((dashboard.kpis.inventory_at_risk_value / dashboard.kpis.total_inventory_value) * 1000) / 10
    : 0;
  const stockoutActions = dashboard.recommendations.filter((row) => String(row.status || "").includes("stockout")).length;
  const plannerHours = Math.max(
    2,
    Math.round((dashboard.recommendations.length + dashboard.waste_risk_alerts.length + dashboard.fefo.length) * 0.2)
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Inventory AI</h1>
          <p>Margin protection for imported food inventory: FEFO, expiration risk, stockouts, and reorder timing.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={() => downloadExecutiveReport(dashboard)}>
            <Download size={17} />
            Executive report
          </button>
          <Link className="button secondary" href="/imports">
            Import CSV
          </Link>
          <Link className="button" href="/query">
            <RefreshCw size={17} />
            Ask Inventory AI
          </Link>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard
          label="Total inventory value"
          value={formatCurrency(dashboard.kpis.total_inventory_value)}
          tone="value"
        />
        <MetricCard
          label="Inventory value at expiration risk"
          value={formatCurrency(dashboard.kpis.inventory_at_risk_value)}
          tone="risk"
        />
        <MetricCard
          label="Projected stockouts"
          value={formatNumber(dashboard.kpis.projected_stockouts)}
          tone="stockout"
        />
        <MetricCard
          label="Recommended reorder value"
          value={formatCurrency(dashboard.kpis.recommended_reorder_value)}
          tone="reorder"
        />
        <MetricCard
          label="Recoverable waste opportunity"
          value={formatCurrency(dashboard.kpis.waste_reduction_opportunity)}
          tone="waste"
        />
      </section>

      <section className="grid-3 buyer-value-grid">
        <div className="insight-card">
          <span className="insight-icon waste">
            <BadgeDollarSign size={18} />
          </span>
          <h2>Waste Dollars Protected</h2>
          <strong>{formatCurrency(dashboard.kpis.waste_reduction_opportunity)}</strong>
          <p>
            Recoverable opportunity from FEFO allocation, transfer, promotion, or discount action before lots become
            distressed.
          </p>
        </div>
        <div className="insight-card">
          <span className="insight-icon stockout">
            <PackageCheck size={18} />
          </span>
          <h2>Fill-Rate Exposure</h2>
          <strong>{stockoutActions.toLocaleString()} urgent actions</strong>
          <p>
            Reorder and allocation exceptions where current inventory, inbound ETAs, and lead-time demand point to lost
            sales risk.
          </p>
        </div>
        <div className="insight-card">
          <span className="insight-icon planner">
            <Clock3 size={18} />
          </span>
          <h2>Planner Time Focused</h2>
          <strong>{plannerHours.toLocaleString()} hours</strong>
          <p>
            A triage estimate for replacing manual spreadsheet checks with ranked exceptions and plain-English reasons.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Buyer Demo Narrative</h2>
        </div>
        <p>
          This pilot frames the week in operating terms: {formatCurrency(dashboard.kpis.inventory_at_risk_value)} at
          expiration risk ({riskShare}% of inventory value), {formatNumber(dashboard.kpis.projected_stockouts)} projected
          stockouts, and {formatCurrency(dashboard.kpis.recommended_reorder_value)} of recommended replenishment. The
          proof point for a buyer is whether planners agree with the reasons and can act before waste or service failures
          show up in ERP reports.
        </p>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Demand Trend By SKU</h2>
          </div>
          <MultiLineChart series={dashboard.charts.demand_trend_by_sku} />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Inventory By Expiration Bucket</h2>
          </div>
          <BarChart
            data={dashboard.charts.inventory_by_expiration_bucket}
            labelKey="bucket"
            valueKey="quantity"
          />
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Reorder Decisions</h2>
          </div>
          <DataTable
            columns={[
              "sku",
              "warehouse",
              "status",
              "recommended_order_qty",
              "reorder_by_date",
              "confidence",
              "reason"
            ]}
            rows={dashboard.recommendations}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Reorder Urgency</h2>
          </div>
          <BarChart data={dashboard.charts.reorder_urgency} labelKey="status" valueKey="count" />
          {dashboard.roi_explanation ? <p>{dashboard.roi_explanation}</p> : null}
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>FEFO Pick Priority</h2>
          </div>
          <DataTable
            columns={[
              "sku",
              "warehouse",
              "ship_first_lot",
              "expiration_date",
              "risk_bucket",
              "suggested_action",
              "reason"
            ]}
            rows={dashboard.fefo}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Waste-Risk Actions</h2>
          </div>
          <DataTable
            columns={[
              "sku",
              "lot_id",
              "warehouse",
              "quantity_at_risk",
              "expiration_date",
              "risk_bucket",
              "suggested_action"
            ]}
            rows={dashboard.waste_risk_alerts}
          />
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>SKUs</h2>
          </div>
          <DataTable
            columns={["sku", "name", "category", "case_size", "shelf_life_days"]}
            rows={state.products.rows}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Customers</h2>
          </div>
          <DataTable columns={["customer_id", "name", "region", "channel"]} rows={state.customers.rows} />
        </div>
      </section>
    </>
  );
}
