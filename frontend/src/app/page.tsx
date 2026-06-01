"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
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

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Inventory AI</h1>
          <p>Margin protection for imported food inventory: FEFO, expiration risk, stockouts, and reorder timing.</p>
        </div>
        <div className="toolbar">
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
