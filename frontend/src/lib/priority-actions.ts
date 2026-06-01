import { DashboardResponse } from "@/lib/api";

function money(value: unknown): string {
  const number = Number(value || 0);
  return number > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number) : "—";
}

function label(row: Record<string, unknown>): string {
  return [row.sku, row.product_name].filter(Boolean).join(" - ");
}

export function buildPriorityActions(dashboard: DashboardResponse): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = [];

  for (const row of dashboard.recommendations) {
    const status = String(row.status || "");
    if (!["stockout risk", "reorder now"].includes(status)) continue;
    actions.push({
      priority: status === "stockout risk" ? "P1" : "P2",
      action_type: status === "stockout risk" ? "Protect fill rate" : "Reorder",
      sku: row.sku,
      product_name: row.product_name,
      category: row.category,
      warehouse: row.warehouse,
      due_date: row.reorder_by_date,
      financial_impact: money(Number(row.recommended_order_qty || 0) * Number(row.unit_cost || 0)),
      recommended_action: row.action || `Order ${row.recommended_order_qty} cases`,
      reason: row.reason,
      confidence: row.confidence,
      confidence_reason: row.confidence_reason
    });
  }

  for (const row of dashboard.waste_risk_alerts) {
    const bucket = String(row.risk_bucket || "");
    actions.push({
      priority: bucket === "0-30 days" || bucket === "expired" ? "P1" : bucket === "31-60 days" ? "P2" : "P3",
      action_type: "Prevent waste",
      sku: row.sku,
      product_name: row.product_name,
      category: row.category,
      warehouse: row.warehouse,
      lot_id: row.lot_id,
      due_date: row.expiration_date,
      financial_impact: money(row.at_risk_value),
      recommended_action: row.suggested_action,
      reason: `${label(row)} lot ${row.lot_id} has ${row.quantity_at_risk} cases in the ${row.risk_bucket} bucket.`,
      confidence: 0.92,
      confidence_reason: "High confidence: expiration date, lot quantity, and unit cost are direct inventory fields."
    });
  }

  for (const row of dashboard.fefo.slice(0, 12)) {
    actions.push({
      priority: String(row.risk_bucket || "").includes("0-30") ? "P1" : "P3",
      action_type: "Ship FEFO lot",
      sku: row.sku,
      product_name: row.product_name,
      category: row.category,
      warehouse: row.warehouse,
      lot_id: row.ship_first_lot,
      due_date: row.expiration_date,
      financial_impact: "—",
      recommended_action: row.suggested_action,
      reason: row.reason,
      confidence: 0.9,
      confidence_reason: "High confidence: FEFO is calculated from lot-level expiration dates."
    });
  }

  const rank: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
  return actions.sort((left, right) => {
    const byPriority = (rank[String(left.priority)] ?? 9) - (rank[String(right.priority)] ?? 9);
    if (byPriority !== 0) return byPriority;
    return String(left.due_date || "").localeCompare(String(right.due_date || ""));
  });
}
