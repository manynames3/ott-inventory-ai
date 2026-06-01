"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, LayoutDashboard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { apiGet, DashboardResponse, formatCurrency } from "@/lib/api";
import { buildPriorityActions } from "@/lib/priority-actions";

export default function ActionsPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DashboardResponse>("/api/dashboard")
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load priority actions."));
  }, []);

  const actions = useMemo(() => (dashboard ? buildPriorityActions(dashboard) : []), [dashboard]);
  const p1Count = actions.filter((row) => row.priority === "P1").length;
  const reorderValue = dashboard?.kpis.recommended_reorder_value || 0;
  const wasteValue = dashboard?.kpis.waste_reduction_opportunity || 0;

  if (error) {
    return (
      <section className="panel">
        <div className="message error">{error}</div>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="panel">
        <div className="empty-state">Loading priority queue</div>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Today&apos;s Priority Actions</h1>
          <p>Ranked planner queue for fill-rate protection, waste prevention, and FEFO execution.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          <Link className="button" href="/query">
            Ask Inventory AI
          </Link>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="P1 actions" value={p1Count.toLocaleString()} tone="stockout" />
        <MetricCard label="Reorder dollars in queue" value={formatCurrency(reorderValue)} tone="reorder" />
        <MetricCard label="Recoverable waste opportunity" value={formatCurrency(wasteValue)} tone="waste" />
      </section>

      <section className="grid-3 buyer-value-grid">
        <div className="insight-card compact">
          <span className="insight-icon stockout">
            <AlertTriangle size={18} />
          </span>
          <h2>Protect Fill Rate</h2>
          <p>Act first on stockout-risk rows where lead-time demand exceeds usable inventory.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon waste">
            <Clock3 size={18} />
          </span>
          <h2>Prevent Waste</h2>
          <p>Move near-expiring lots by allocation, transfer, promotion, or discount before newer lots ship.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon planner">
            <CheckCircle2 size={18} />
          </span>
          <h2>Defend The Decision</h2>
          <p>Each action includes the operational reason and confidence note a planner can challenge.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Ranked Action Queue</h2>
            <p>{actions.length.toLocaleString()} recommendations ranked by urgency and due date.</p>
          </div>
        </div>
        <DataTable
          columns={[
            "priority",
            "action_type",
            "sku",
            "product_name",
            "category",
            "warehouse",
            "lot_id",
            "due_date",
            "financial_impact",
            "recommended_action",
            "reason",
            "confidence",
            "confidence_reason"
          ]}
          rows={actions}
        />
      </section>
    </>
  );
}
