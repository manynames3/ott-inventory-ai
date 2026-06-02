"use client";

import Link from "next/link";
import { BadgeDollarSign, Clock3, Download, PackageCheck, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { BarChart, MultiLineChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { apiGet, DashboardResponse, formatCurrency, formatNumber, TableResponse } from "@/lib/api";
import { buildPriorityActions } from "@/lib/priority-actions";

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
  const topRecommendation = dashboard.recommendations.find((row) => String(row.status || "").includes("stockout"));
  const topFefoAction = dashboard.fefo[0];
  const topWasteAction = dashboard.waste_risk_alerts[0];
  const recoveryLow = dashboard.kpis.inventory_at_risk_value * 0.2;
  const recoveryBase = dashboard.kpis.waste_reduction_opportunity;
  const recoveryHigh = dashboard.kpis.inventory_at_risk_value * 0.5;
  const plannerValue = plannerHours * 75;
  const topStockout = dashboard.recommendations.find((row) => String(row.status || "").includes("stockout"));
  const topWaste = dashboard.waste_risk_alerts[0];
  const topFefo = dashboard.fefo[0];
  const priorityActions = buildPriorityActions(dashboard).slice(0, 12);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>StockSense AI Executive ROI Report</title>
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
    .scorecard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 18px 0; }
    .scorecard div { border: 1px solid #dfe5df; border-radius: 8px; padding: 14px; }
    .scorecard span { color: #66736d; display: block; font-size: 12px; margin-bottom: 6px; }
    .scorecard strong { display: block; font-size: 20px; }
    .empty { color: #66736d; }
    @media print { body { margin: 22px; } .grid, .scorecard { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <h1>StockSense AI Executive ROI Report</h1>
  <p class="muted">Generated ${escapeHtml(generatedAt)} from current inventory data.</p>
  <div class="callout">
    <strong>Executive readout:</strong>
    ${escapeHtml(formatCurrency(dashboard.kpis.inventory_at_risk_value))} of inventory is currently at expiration risk (${riskShare}% of inventory value), ${escapeHtml(
      String(stockoutActions)
    )} replenishment actions are flagged as stockout exposure, and approximately ${escapeHtml(
      String(plannerHours)
    )} planner triage hours are being concentrated into a prioritized exception queue.
  </div>
  <h2>Pilot ROI Scorecard</h2>
  <div class="scorecard">
    <div><span>Low recovery case</span><strong>${escapeHtml(formatCurrency(recoveryLow))}</strong><p class="muted">20% of expiration-risk value protected.</p></div>
    <div><span>Base recovery case</span><strong>${escapeHtml(formatCurrency(recoveryBase))}</strong><p class="muted">Current model assumption from FEFO, transfer, promotion, and discount action.</p></div>
    <div><span>High recovery case</span><strong>${escapeHtml(formatCurrency(recoveryHigh))}</strong><p class="muted">50% of expiration-risk value protected.</p></div>
    <div><span>Planner triage value</span><strong>${escapeHtml(formatCurrency(plannerValue))}</strong><p class="muted">${escapeHtml(String(plannerHours))} focused hours at $75/hour planning cost.</p></div>
    <div><span>Fill-rate exceptions</span><strong>${escapeHtml(String(stockoutActions))}</strong><p class="muted">SKUs/warehouses where replenishment or allocation should be reviewed now.</p></div>
    <div><span>Inventory risk share</span><strong>${escapeHtml(String(riskShare))}%</strong><p class="muted">Expiration-risk value divided by current inventory value.</p></div>
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
  <h2>Executive Action Narrative</h2>
  <table><tbody>
    <tr><th>Waste control</th><td>${escapeHtml(
      topWaste
        ? `${String(topWaste.sku ?? "")} lot ${String(topWaste.lot_id ?? "")} has ${String(topWaste.quantity_at_risk ?? "")} units at risk by ${String(topWaste.expiration_date ?? "")}; suggested action: ${String(topWaste.suggested_action ?? "")}`
        : "No waste-risk lots are currently listed."
    )}</td></tr>
    <tr><th>FEFO discipline</th><td>${escapeHtml(
      topFefo
        ? `${String(topFefo.sku ?? "")} should ship lot ${String(topFefo.ship_first_lot ?? "")} first in ${String(topFefo.warehouse ?? "")}; reason: ${String(topFefo.reason ?? "")}`
        : "No FEFO recommendation is currently listed."
    )}</td></tr>
    <tr><th>Fill-rate protection</th><td>${escapeHtml(
      topStockout
        ? `${String(topStockout.sku ?? "")} in ${String(topStockout.warehouse ?? "")} is flagged as ${String(topStockout.status ?? "")}; reason: ${String(topStockout.reason ?? "")}`
        : "No stockout-risk recommendation is currently listed."
    )}</td></tr>
  </tbody></table>
  <h2>Today&apos;s Priority Actions</h2>
  ${reportRows(priorityActions, ["priority", "action_type", "sku", "product_name", "warehouse", "due_date", "financial_impact", "recommended_action", "confidence_reason"])}
  <h2>What To Reorder This Week</h2>
  ${reportRows(dashboard.recommendations, ["sku", "product_name", "warehouse", "status", "recommended_order_qty", "estimated_order_value", "reorder_by_date", "action", "reason", "confidence_reason"])}
  <h2>What To Ship First</h2>
  ${reportRows(dashboard.fefo, ["sku", "product_name", "warehouse", "ship_first_lot", "expiration_date", "risk_bucket", "reason"])}
  <h2>Waste-Risk Actions</h2>
  ${reportRows(dashboard.waste_risk_alerts, ["sku", "product_name", "lot_id", "warehouse", "quantity_at_risk", "at_risk_value", "expiration_date", "suggested_action"])}
  <h2>Assumptions And Data Controls</h2>
  <table><tbody>
    <tr><th>Waste recovery</th><td>Base case uses current recoverable waste opportunity from the model; low and high cases use 20% and 50% of expiration-risk value.</td></tr>
    <tr><th>Planner time</th><td>Planner focus estimate counts ranked FEFO, waste-risk, and reorder exceptions, valued at $75/hour for executive comparison.</td></tr>
    <tr><th>Forecasting</th><td>Demand uses historical order exports, simple moving averages, exponential smoothing, and trend placeholders.</td></tr>
    <tr><th>Controls</th><td>Recommendations are decision support only. StockSense AI stores raw uploads privately, logs import/query activity, and does not write back to ERP.</td></tr>
  </tbody></table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stocksense-ai-executive-roi-report.html";
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
            <h1>StockSense AI</h1>
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
  const stockoutActions = dashboard.recommendations.filter((row) => String(row.status || "").includes("stockout")).length;
  const plannerHours = Math.max(
    2,
    Math.round((dashboard.recommendations.length + dashboard.waste_risk_alerts.length + dashboard.fefo.length) * 0.2)
  );
  const topRecommendation = dashboard.recommendations.find((row) => String(row.status || "").includes("stockout"));
  const topFefoAction = dashboard.fefo[0];
  const topWasteAction = dashboard.waste_risk_alerts[0];
  const priorityActions = buildPriorityActions(dashboard);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>StockSense AI</h1>
          <p>FEFO, expiration risk, stockouts, and reorder timing.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={() => downloadExecutiveReport(dashboard)}>
            <Download size={17} />
            Executive report
          </button>
          <Link className="button secondary" href="/imports">
            Import CSV
          </Link>
          <Link className="button secondary" href="/actions">
            Priority actions
          </Link>
          <Link className="button" href="/query">
            <RefreshCw size={17} />
            Ask StockSense AI
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
          <p>FEFO allocation, transfer, promotion, and discount opportunity.</p>
        </div>
        <div className="insight-card">
          <span className="insight-icon stockout">
            <PackageCheck size={18} />
          </span>
          <h2>Fill-Rate Exposure</h2>
          <strong>{stockoutActions.toLocaleString()} urgent actions</strong>
          <p>Reorder and allocation exceptions requiring review.</p>
        </div>
        <div className="insight-card">
          <span className="insight-icon planner">
            <Clock3 size={18} />
          </span>
          <h2>Planner Time Focused</h2>
          <strong>{plannerHours.toLocaleString()} hours</strong>
          <p>Estimated exception review time concentrated into ranked actions.</p>
        </div>
      </section>

      <section className="grid-3 buyer-value-grid">
        <div className="scenario-card">
          <h2>Top Waste Action</h2>
          <p>
            {topWasteAction
              ? `${String(topWasteAction.sku ?? "")} ${String(topWasteAction.product_name ?? "")} lot ${String(topWasteAction.lot_id ?? "")} has ${String(
                  topWasteAction.quantity_at_risk ?? ""
                )} units at risk before ${String(topWasteAction.expiration_date ?? "")}.`
              : "No current waste-risk scenario is available."}
          </p>
        </div>
        <div className="scenario-card">
          <h2>Next FEFO Pick</h2>
          <p>
            {topFefoAction
              ? `${String(topFefoAction.sku ?? "")} ${String(topFefoAction.product_name ?? "")} should ship lot ${String(topFefoAction.ship_first_lot ?? "")} first from ${String(
                  topFefoAction.warehouse ?? ""
                )}.`
              : "No current FEFO scenario is available."}
          </p>
        </div>
        <div className="scenario-card">
          <h2>Top Fill-Rate Risk</h2>
          <p>
            {topRecommendation
              ? `${String(topRecommendation.sku ?? "")} ${String(topRecommendation.product_name ?? "")} is flagged for ${String(topRecommendation.status ?? "")} because ${String(
                  topRecommendation.reason ?? ""
                )}`
              : "No current fill-rate scenario is available."}
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Today&apos;s Priority Actions</h2>
            <p>Ranked by fill-rate risk, expiration exposure, due date, and confidence.</p>
          </div>
          <Link className="button secondary" href="/actions">
            View all actions
          </Link>
        </div>
        <DataTable
          columns={[
            "priority",
            "action_type",
            "sku",
            "product_name",
            "warehouse",
            "due_date",
            "financial_impact",
            "recommended_action",
            "confidence_reason"
          ]}
          rows={priorityActions.slice(0, 10)}
        />
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
              "product_name",
              "category",
              "warehouse",
              "status",
              "recommended_order_qty",
              "estimated_order_value",
              "reorder_by_date",
              "action",
              "confidence",
              "confidence_reason",
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
              "product_name",
              "category",
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
              "product_name",
              "category",
              "lot_id",
              "warehouse",
              "quantity_at_risk",
              "at_risk_value",
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
