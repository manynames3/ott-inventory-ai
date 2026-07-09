"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BarChart, MultiLineChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { PageError, PageLoading } from "@/components/feedback";
import { StatusPill } from "@/components/status-pill";
import {
  apiGet,
  DashboardResponse,
  formatCurrency,
  formatNumber,
  ImportHistoryResponse,
  SHOW_DEMO_BANNER,
  TableResponse
} from "@/lib/api";
import { buildPriorityActions } from "@/lib/priority-actions";

type DashboardState = {
  dashboard: DashboardResponse | null;
  products: TableResponse;
  customers: TableResponse;
  importHistory: ImportHistoryResponse | null;
  error: string | null;
  loading: boolean;
};

type ReadableActionField = {
  key: string;
  label: string;
};

type ActionFilter = "All" | "P1" | "P2" | "P3";

const actionFilters: ActionFilter[] = ["All", "P1", "P2", "P3"];

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

function formatReadableValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if ((key.includes("value") || key.includes("cost")) && typeof value === "number") {
    return formatCurrency(value);
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  return String(value);
}

function formatFreshness(epoch?: number) {
  if (!epoch) return "No import refresh recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(epoch * 1000);
}

function actionKey(row: Record<string, unknown>, index: number) {
  return [row.priority, row.action_type, row.sku, row.warehouse, row.lot_id || "sku", row.due_date, index]
    .map((value) => String(value || ""))
    .join("::");
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return String(value);
}

function confidenceLabel(value: unknown) {
  if (typeof value === "number") {
    return value >= 0.86 ? "High" : value >= 0.72 ? "Medium" : "Review";
  }
  const raw = String(value || "");
  if (raw.toLowerCase().includes("high")) return "High";
  if (raw.toLowerCase().includes("medium")) return "Medium";
  return "Review";
}

function actionTypeIcon(actionType: unknown) {
  const label = String(actionType || "").toLowerCase();
  if (label.includes("ship")) return <Clock3 size={16} />;
  if (label.includes("waste")) return <AlertTriangle size={16} />;
  if (label.includes("reorder")) return <ShoppingCart size={16} />;
  return <PackageCheck size={16} />;
}

function actionTypeTone(actionType: unknown) {
  const label = String(actionType || "").toLowerCase();
  if (label.includes("waste")) return "risk";
  if (label.includes("ship")) return "fefo";
  if (label.includes("reorder")) return "reorder";
  return "stockout";
}

function checklistLabel(entity: string) {
  return entity.replaceAll("_", " ");
}

function ReadableActionList({
  rows,
  emptyLabel,
  metaFields,
  bodyFields
}: {
  rows: Record<string, unknown>[];
  emptyLabel: string;
  metaFields: ReadableActionField[];
  bodyFields: ReadableActionField[];
}) {
  if (!rows.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="readable-action-list">
      {rows.map((row, index) => {
        const sku = row.sku ? String(row.sku) : "Unknown SKU";
        const productName = row.product_name ? String(row.product_name) : "";
        const risk = row.risk_bucket || row.risk_level;

        return (
          <article className="readable-action-card" key={`${sku}-${String(row.lot_id || row.ship_first_lot || "row")}-${index}`}>
            <div className="readable-action-heading">
              <div>
                <Link href={`/sku?sku=${encodeURIComponent(sku)}`} className="readable-action-title">
                  {sku}
                </Link>
                {productName ? <p>{productName}</p> : null}
              </div>
              {risk ? <StatusPill value={risk} /> : null}
            </div>

            <dl className="readable-action-meta">
              {metaFields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{formatReadableValue(field.key, row[field.key])}</dd>
                </div>
              ))}
            </dl>

            <div className="readable-action-copy">
              {bodyFields.map((field) => (
                <div key={field.key}>
                  <span>{field.label}</span>
                  <p>{formatReadableValue(field.key, row[field.key])}</p>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function downloadExecutiveReport(dashboard: DashboardResponse) {
  const generatedAt = new Date().toLocaleString("en-US");
  const stockoutActions = dashboard.recommendations.filter((row) => String(row.status || "").includes("stockout")).length;
  const riskShare = dashboard.kpis.total_inventory_value
    ? Math.round((dashboard.kpis.inventory_at_risk_value / dashboard.kpis.total_inventory_value) * 1000) / 10
    : 0;
  const topStockout = dashboard.recommendations.find((row) => String(row.status || "").includes("stockout"));
  const topWaste = dashboard.waste_risk_alerts[0];
  const topFefo = dashboard.fefo[0];
  const priorityActions = buildPriorityActions(dashboard).slice(0, 12);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>StockSense AI Executive Operations Report</title>
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
  <h1>StockSense AI Executive Operations Report</h1>
  <p class="muted">Generated ${escapeHtml(generatedAt)} from current inventory data.</p>
  <div class="callout">
    <strong>Executive readout:</strong>
    ${escapeHtml(formatCurrency(dashboard.kpis.inventory_at_risk_value))} of inventory is currently at expiration risk (${riskShare}% of inventory value), ${escapeHtml(
      String(stockoutActions)
    )} replenishment actions are flagged as stockout exposure, and ${escapeHtml(
      String(priorityActions.length)
    )} priority actions are currently ranked for planner review.
  </div>
  <h2>Operations Scorecard</h2>
  <div class="scorecard">
    <div><span>Expiration-risk value</span><strong>${escapeHtml(formatCurrency(dashboard.kpis.inventory_at_risk_value))}</strong><p class="muted">Current inventory value within the configured expiration-risk window.</p></div>
    <div><span>Recoverable opportunity</span><strong>${escapeHtml(formatCurrency(dashboard.kpis.waste_reduction_opportunity))}</strong><p class="muted">Modeled opportunity from current FEFO, transfer, promotion, and discount recommendations.</p></div>
    <div><span>Recommended reorder value</span><strong>${escapeHtml(formatCurrency(dashboard.kpis.recommended_reorder_value))}</strong><p class="muted">Current replenishment recommendations, before planner approval.</p></div>
    <div><span>Priority actions</span><strong>${escapeHtml(String(priorityActions.length))}</strong><p class="muted">Ranked exceptions available for planner review.</p></div>
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
    <tr><th>Waste recovery</th><td>Recoverable opportunity is a modeled decision-support estimate. Confirm actual recovery from reviewed actions and downstream operating results.</td></tr>
    <tr><th>Forecasting</th><td>Demand blends moving-average and exponential-smoothing estimates. Trend and seasonality notes are reported only from available order history.</td></tr>
    <tr><th>Controls</th><td>Recommendations are decision support only. StockSense AI stores raw uploads privately, logs import/query activity, and does not write back to ERP.</td></tr>
  </tbody></table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stocksense-ai-executive-operations-report.html";
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    dashboard: null,
    products: { rows: [] },
    customers: { rows: [] },
    importHistory: null,
    error: null,
    loading: true
  });
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [activeActionFilter, setActiveActionFilter] = useState<ActionFilter>("All");
  const [selectedActionKey, setSelectedActionKey] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [dashboard, products, customers, importHistory] = await Promise.all([
          apiGet<DashboardResponse>("/api/dashboard"),
          apiGet<TableResponse>("/api/products?limit=8"),
          apiGet<TableResponse>("/api/customers?limit=8"),
          apiGet<ImportHistoryResponse>("/api/import-history?limit=25")
        ]);
        if (active) {
          setState({ dashboard, products, customers, importHistory, error: null, loading: false });
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
  }, [loadVersion]);

  useEffect(() => {
    setShowDemoBanner(SHOW_DEMO_BANNER && window.localStorage.getItem("stocksense_demo_banner_dismissed") !== "true");
  }, []);

  useEffect(() => {
    if (!state.dashboard) return;
    const actions = buildPriorityActions(state.dashboard);
    if (!actions.length) return;
    setSelectedActionKey((current) =>
      actions.some((row, index) => actionKey(row, index) === current) ? current : actionKey(actions[0], 0)
    );
  }, [state.dashboard]);

  function dismissDemoBanner() {
    window.localStorage.setItem("stocksense_demo_banner_dismissed", "true");
    setShowDemoBanner(false);
  }

  if (state.loading) {
    return <PageLoading label="Loading inventory overview" />;
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
        <PageError
          title="Inventory overview is unavailable"
          message={state.error || "The latest workspace data could not be loaded."}
          action={
            <button
              className="button"
              type="button"
              onClick={() => {
                setState((current) => ({ ...current, loading: true, error: null }));
                setLoadVersion((current) => current + 1);
              }}
            >
              <RefreshCw size={17} />
              Try again
            </button>
          }
        />
      </>
    );
  }

  const dashboard = state.dashboard;
  const stockoutActions = dashboard.recommendations.filter((row) => String(row.status || "").includes("stockout")).length;
  const priorityActions = buildPriorityActions(dashboard);
  const checklist = state.importHistory?.checklist || [];
  const completeDatasets = checklist.filter((item) => item.status === "complete").length;
  const latestImportEpoch = Math.max(0, ...checklist.map((item) => item.updated_at_epoch || 0));
  const failedImports = (state.importHistory?.rows || []).filter((row) => row.status === "failed").length;
  const priorityCounts = {
    All: priorityActions.length,
    P1: priorityActions.filter((row) => row.priority === "P1").length,
    P2: priorityActions.filter((row) => row.priority === "P2").length,
    P3: priorityActions.filter((row) => row.priority === "P3").length
  };
  const filteredPriorityActions =
    activeActionFilter === "All"
      ? priorityActions
      : priorityActions.filter((row) => String(row.priority) === activeActionFilter);
  const selectedActionIndex = priorityActions.findIndex((row, index) => actionKey(row, index) === selectedActionKey);
  const selectedAction = priorityActions[selectedActionIndex >= 0 ? selectedActionIndex : 0] || null;
  const selectedActionTone = selectedAction ? actionTypeTone(selectedAction.action_type) : "stockout";
  const selectedActionLot = selectedAction?.lot_id || selectedAction?.ship_first_lot || "Lot pending";
  const selectedActionReason = selectedAction?.reason || selectedAction?.confidence_reason || "No action reason available.";
  const riskBuckets = dashboard.charts.inventory_by_expiration_bucket.slice(0, 5);
  const maxRiskValue = Math.max(1, ...riskBuckets.map((row) => Number(row.value || row.quantity || 0)));
  const readinessItems = checklist.length
    ? checklist
    : [
        { entity: "products", label: "Products", status: "missing" as const, required_columns: [], message: "Waiting for upload", rows_imported: 0, error_count: 0 },
        { entity: "inventory_lots", label: "Inventory lots", status: "missing" as const, required_columns: [], message: "Waiting for upload", rows_imported: 0, error_count: 0 },
        { entity: "orders", label: "Orders", status: "missing" as const, required_columns: [], message: "Waiting for upload", rows_imported: 0, error_count: 0 },
        { entity: "customers", label: "Customers", status: "missing" as const, required_columns: [], message: "Waiting for upload", rows_imported: 0, error_count: 0 },
        { entity: "inbound_shipments", label: "Inbound shipments", status: "missing" as const, required_columns: [], message: "Waiting for upload", rows_imported: 0, error_count: 0 }
      ];
  const recentActivity = (state.importHistory?.rows || []).slice(0, 4);
  const topStockoutRows = priorityActions
    .filter((row) => {
      const actionType = String(row.action_type || "").toLowerCase();
      return actionType.includes("fill") || actionType.includes("reorder");
    })
    .slice(0, 3);

  function selectActionFilter(filter: ActionFilter) {
    setActiveActionFilter(filter);
    const nextRows = filter === "All" ? priorityActions : priorityActions.filter((row) => String(row.priority) === filter);
    if (nextRows[0]) {
      setSelectedActionKey(actionKey(nextRows[0], priorityActions.indexOf(nextRows[0])));
    }
  }

  return (
    <>
      {showDemoBanner ? (
        <div className="dashboard-demo-banner modern-demo-banner" role="status">
          <p>You&apos;re viewing a live demo using sample Ottogi inventory data. Import your own CSV to see your numbers.</p>
          <button className="dashboard-demo-banner-close" type="button" onClick={dismissDemoBanner} aria-label="Dismiss demo banner">
            ×
          </button>
        </div>
      ) : null}

      <section className="ops-status-ribbon" aria-label="Workspace status">
        <div className="status-ribbon-primary">
          <span>Data freshness</span>
          <strong>
            <i aria-hidden="true" />
            {latestImportEpoch ? `Last refresh: ${formatFreshness(latestImportEpoch)}` : "No import refresh recorded"}
          </strong>
          <Link href="/imports">View details</Link>
        </div>
        <div className="status-ribbon-item">
          <CheckCircle2 size={17} />
          <span>Imports ready</span>
          <strong>{checklist.length ? `${completeDatasets}/${checklist.length}` : "0/5"}</strong>
        </div>
        <div className="status-ribbon-item">
          <ShieldCheck size={17} />
          <span>No ERP writeback</span>
        </div>
        <div className="status-ribbon-item">
          <CheckCircle2 size={17} />
          <span>{failedImports ? `${failedImports} import issues` : "No import failures"}</span>
        </div>
      </section>

      <section className="command-metric-grid" aria-label="Operations metrics">
        <article className="command-metric command-metric-value">
          <span><BadgeDollarSign size={21} /></span>
          <p>Inventory value</p>
          <strong>{formatCurrency(dashboard.kpis.total_inventory_value)}</strong>
          <small>Live inventory basis</small>
        </article>
        <article className="command-metric command-metric-risk">
          <span><AlertTriangle size={21} /></span>
          <p>Expiring risk</p>
          <strong>{formatCurrency(dashboard.kpis.inventory_at_risk_value)}</strong>
          <small>Next 90 days</small>
        </article>
        <article className="command-metric command-metric-stockout">
          <span><PackageCheck size={21} /></span>
          <p>Stockout exposure</p>
          <strong>{formatNumber(dashboard.kpis.projected_stockouts)}</strong>
          <small>{stockoutActions.toLocaleString()} urgent {stockoutActions === 1 ? "action" : "actions"}</small>
        </article>
        <article className="command-metric command-metric-reorder">
          <span><ShoppingCart size={21} /></span>
          <p>Reorder value</p>
          <strong>{formatCurrency(dashboard.kpis.recommended_reorder_value)}</strong>
          <small>Recommended this week</small>
        </article>
        <article className="command-metric command-metric-waste">
          <span><ShieldCheck size={21} /></span>
          <p>Recoverable waste</p>
          <strong>{formatCurrency(dashboard.kpis.waste_reduction_opportunity)}</strong>
          <small>Modeled opportunity</small>
        </article>
      </section>

      <section className="command-center-grid">
        <section className="priority-command-panel" aria-labelledby="priority-heading">
          <div className="command-panel-header">
            <div>
              <h1 id="priority-heading">Today&apos;s Priority Actions</h1>
              <p>Ranked by fill-rate risk, expiration exposure, due date, and confidence.</p>
            </div>
            <div className="panel-inline-actions">
              <button className="text-icon-button" type="button" onClick={() => downloadExecutiveReport(dashboard)}>
                <Download size={16} />
                Export report
              </button>
              <Link className="text-icon-button" href="/actions">
                View all actions
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="priority-filter-row" aria-label="Priority filters">
            {actionFilters.map((filter) => (
              <button
                className={filter === activeActionFilter ? "priority-filter active" : "priority-filter"}
                type="button"
                key={filter}
                onClick={() => selectActionFilter(filter)}
                aria-pressed={filter === activeActionFilter}
              >
                {filter}
                <strong>{priorityCounts[filter]}</strong>
              </button>
            ))}
          </div>

          <div className="priority-table-wrap">
            <table className="priority-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Type</th>
                  <th>SKU / product</th>
                  <th>Lot / due</th>
                  <th>Action / impact</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {filteredPriorityActions.slice(0, 6).map((row) => {
                  const originalIndex = priorityActions.indexOf(row);
                  const key = actionKey(row, originalIndex);
                  const isSelected = selectedActionKey === key;
                  return (
                    <tr className={isSelected ? "priority-table-row selected" : "priority-table-row"} key={key}>
                      <td><StatusPill value={row.priority} /></td>
                      <td>
                        <span className={`action-kind action-kind-${actionTypeTone(row.action_type)}`}>
                          {actionTypeIcon(row.action_type)}
                          {text(row.action_type)}
                        </span>
                      </td>
                      <td className="sku-product-cell">
                        <Link className="table-link" href={`/sku?sku=${encodeURIComponent(String(row.sku || ""))}`}>{text(row.sku)}</Link>
                        <small>{text(row.product_name)}</small>
                      </td>
                      <td className="lot-due-cell">
                        <span>{text(row.lot_id || row.warehouse)}</span>
                        <small>{text(row.due_date)}</small>
                      </td>
                      <td className="recommended-action-cell">
                        <span>{text(row.recommended_action)}</span>
                        <strong>{text(row.financial_impact)}</strong>
                        <span className="confidence-chip">{confidenceLabel(row.confidence)}</span>
                      </td>
                      <td>
                        <button
                          className="row-view-action"
                          type="button"
                          aria-label={`View action details for ${text(row.sku)}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedActionKey(key)}
                        >
                          <Eye size={15} aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={`action-detail-panel action-detail-${selectedActionTone}`} aria-label="Selected action details">
          {selectedAction ? (
            <>
              <div className="action-detail-header">
                <div className="product-thumb" aria-hidden="true">
                  <PackageCheck size={30} />
                </div>
                <div>
                  <span className="detail-tag">{text(selectedAction.action_type)}</span>
                  <h2>{text(selectedAction.sku)} - {text(selectedAction.product_name)}</h2>
                  <p>{text(selectedActionLot)} · {text(selectedAction.warehouse)}</p>
                </div>
              </div>

              <div className="detail-alert-line">
                <AlertTriangle size={16} />
                <span>Due {text(selectedAction.due_date)}</span>
              </div>

              <section className="detail-section">
                <h3>Why this matters</h3>
                <p>{text(selectedActionReason)}</p>
                {selectedAction.financial_impact ? <strong>{text(selectedAction.financial_impact)} protected or exposed value.</strong> : null}
              </section>

              <section className="source-field-list">
                <h3>Source fields</h3>
                <dl>
                  <div><dt>SKU</dt><dd>{text(selectedAction.sku)}</dd></div>
                  <div><dt>Category</dt><dd>{text(selectedAction.category)}</dd></div>
                  <div><dt>Warehouse</dt><dd>{text(selectedAction.warehouse)}</dd></div>
                  <div><dt>Confidence</dt><dd>{confidenceLabel(selectedAction.confidence)}</dd></div>
                </dl>
              </section>

              <div className="approval-card">
                <span>Planner workflow</span>
                <strong>Review required</strong>
                <p>Add notes and record an approval or dismissal in the server-backed action queue.</p>
                <Link className="button" href="/actions">Review action queue <ArrowRight size={16} /></Link>
              </div>
            </>
          ) : (
            <div className="empty-state">No priority action selected.</div>
          )}
        </aside>
      </section>

      <section className="support-command-grid">
        <article className="support-panel risk-timeline-panel">
          <div className="panel-header compact-panel-header">
            <div>
              <h2>Expiration risk timeline</h2>
              <p>Inventory value by expiration bucket.</p>
            </div>
          </div>
          <div className="risk-timeline">
            {riskBuckets.map((row, index) => {
              const value = Number(row.value || row.quantity || 0);
              const percent = Math.max(8, Math.round((value / maxRiskValue) * 100));
              return (
                <div className={`risk-timeline-cell risk-level-${index}`} key={String(row.bucket)}>
                  <span>{String(row.bucket)}</span>
                  <strong>{formatCurrency(value)}</strong>
                  <i style={{ width: `${percent}%` }} />
                </div>
              );
            })}
          </div>
        </article>

        <article className="support-panel import-readiness-panel">
          <div className="panel-header compact-panel-header">
            <div>
              <h2>Data setup & imports</h2>
              <p>Required datasets for trusted recommendations.</p>
            </div>
            <strong className="ready-count">{completeDatasets}/{readinessItems.length}</strong>
          </div>
          <div className="readiness-list">
            {readinessItems.slice(0, 5).map((item) => (
              <div className="readiness-row" key={item.entity}>
                <CheckCircle2 size={17} />
                <span>{item.label || checklistLabel(item.entity)}</span>
                <strong>{item.rows_imported ? `${item.rows_imported.toLocaleString()} rows` : item.status}</strong>
                <Link href="/imports">View</Link>
              </div>
            ))}
          </div>
          <Link className="support-link" href="/imports">Go to imports <ArrowRight size={15} /></Link>
        </article>

        <article className="support-panel ask-panel">
          <div className="panel-header compact-panel-header">
          <div>
              <h2>Ask StockSense</h2>
              <p>Safe answers from approved operational views.</p>
            </div>
            <span className="beta-chip">Cited</span>
          </div>
          <div className="ask-question">
            <Search size={16} />
            <span>Which SKUs are likely to stock out in the next 30 days?</span>
          </div>
          <p className="ask-answer">
            {topStockoutRows.length
              ? `${topStockoutRows.length} priority SKUs need planner review. Top risk: ${text(topStockoutRows[0].sku)} - ${text(topStockoutRows[0].product_name)}.`
              : "No stockout-risk priority rows are currently listed."}
          </p>
          <ul className="ask-source-list">
            {topStockoutRows.map((row, index) => (
              <li key={`${String(row.sku)}-${String(row.due_date)}-${index}`}>{text(row.sku)} - {text(row.financial_impact)}</li>
            ))}
          </ul>
          <Link className="support-link" href="/query">Go to query <ArrowRight size={15} /></Link>
        </article>
      </section>

      <section className="recent-activity-strip" aria-label="Recent activity">
        <strong>Recent activity</strong>
        {recentActivity.length ? (
          recentActivity.map((row) => (
            <span key={`${row.entity || row.filename}-${row.updated_at_epoch || row.message}`}>
              <Check size={15} />
              {checklistLabel(String(row.entity || row.filename || "Import"))} {row.status || "updated"}
            </span>
          ))
        ) : (
          <span><Check size={15} /> No recent import activity</span>
        )}
        <Link href="/audit">View all activity <ArrowRight size={15} /></Link>
      </section>

      <section className="dashboard-deep-dive grid-2">
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

      <section className="panel reorder-decisions-panel">
        <div className="panel-header">
          <h2>Reorder Decisions</h2>
        </div>
        <DataTable
          tableClassName="reorder-decisions-table"
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Reorder Urgency</h2>
        </div>
        <BarChart data={dashboard.charts.reorder_urgency} labelKey="status" valueKey="count" />
        {dashboard.roi_explanation ? <p>{dashboard.roi_explanation}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>FEFO Pick Priority</h2>
        </div>
        <ReadableActionList
          rows={dashboard.fefo}
          emptyLabel="No FEFO pick priority rows"
          metaFields={[
            { key: "category", label: "Category" },
            { key: "warehouse", label: "Warehouse" },
            { key: "ship_first_lot", label: "Ship first lot" },
            { key: "expiration_date", label: "Expiration" }
          ]}
          bodyFields={[
            { key: "suggested_action", label: "Suggested action" },
            { key: "reason", label: "Business reason" }
          ]}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Waste-Risk Actions</h2>
        </div>
        <ReadableActionList
          rows={dashboard.waste_risk_alerts}
          emptyLabel="No waste-risk actions"
          metaFields={[
            { key: "category", label: "Category" },
            { key: "warehouse", label: "Warehouse" },
            { key: "lot_id", label: "Lot" },
            { key: "quantity_at_risk", label: "Qty at risk" },
            { key: "at_risk_value", label: "Risk value" },
            { key: "expiration_date", label: "Expiration" }
          ]}
          bodyFields={[{ key: "suggested_action", label: "Suggested action" }]}
        />
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
