"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BarChart, MultiLineChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageError, PageLoading } from "@/components/feedback";
import { StatusPill } from "@/components/status-pill";
import { apiGet, formatNumber } from "@/lib/api";

type SkuDetail = {
  product: Record<string, unknown> | null;
  inventory_lots: Record<string, unknown>[];
  inbound_shipments: Record<string, unknown>[];
  forecast: {
    blended_daily_demand: number;
    horizons: Record<string, unknown>[];
    models: Record<string, number>;
    trend: string;
    seasonality: string;
  };
  reorder_recommendations: Record<string, unknown>[];
  fefo: Record<string, unknown>[];
  demand_trend: { sku: string; points: { label: string; value: number }[] }[];
};

function formatActionValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (key === "confidence" && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  return String(value);
}

function SkuReorderActions({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <div className="empty-state">No reorder actions</div>;
  }

  return (
    <div className="sku-reorder-action-list">
      {rows.map((row, index) => {
        const status = row.status;
        const warehouse = formatActionValue("warehouse", row.warehouse);

        return (
          <article className="sku-reorder-action-card" key={`${warehouse}-${String(status || index)}-${index}`}>
            <div className="sku-reorder-action-summary">
              <div className="sku-reorder-action-heading">
                <div>
                  <span>Warehouse</span>
                  <strong>{warehouse}</strong>
                </div>
                {status ? <StatusPill value={status} /> : null}
              </div>
              <dl>
                <div>
                  <dt>Recommended order qty</dt>
                  <dd>{formatActionValue("recommended_order_qty", row.recommended_order_qty)}</dd>
                </div>
                <div>
                  <dt>Reorder by date</dt>
                  <dd>{formatActionValue("reorder_by_date", row.reorder_by_date)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{formatActionValue("confidence", row.confidence)}</dd>
                </div>
              </dl>
            </div>
            <div className="sku-reorder-action-reason">
              <span>Reason</span>
              <p>{formatActionValue("reason", row.reason)}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SkuDetailClient() {
  const params = useSearchParams();
  const sku = params.get("sku")?.trim() || "";
  const [detail, setDetail] = useState<SkuDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedSku, setLoadedSku] = useState("");

  useEffect(() => {
    if (!sku) return;
    let active = true;
    apiGet<SkuDetail>(`/api/sku/${encodeURIComponent(sku)}`)
      .then((response) => {
        if (active) {
          setDetail(response);
          setError(null);
          setLoadedSku(sku);
        }
      })
      .catch((err) => {
        if (active) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Could not load SKU detail");
          setLoadedSku(sku);
        }
      });
    return () => {
      active = false;
    };
  }, [sku]);

  if (!sku) {
    return (
      <>
        <header className="page-header">
          <div>
            <h1>SKU detail</h1>
            <p>Open a product from search, the dashboard, or an inventory table.</p>
          </div>
        </header>
        <EmptyState
          title="No SKU selected"
          message="Choose a SKU from the inventory overview to inspect demand, lots, inbound supply, and reorder recommendations."
          action={<Link className="button" href="/">Browse inventory</Link>}
        />
      </>
    );
  }

  if (loadedSku !== sku) return <PageLoading label="Loading SKU detail" />;

  if (error) {
    return <PageError title="SKU could not be loaded" message={error} action={<Link className="button secondary" href="/">Back to overview</Link>} />;
  }

  if (!detail) return <PageLoading label="Loading SKU detail" />;

  const product = detail.product || {};
  const modelRows = Object.entries(detail.forecast.models).map(([model, daily_demand]) => ({
    model,
    daily_demand
  }));

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{String(product.sku || sku)}</h1>
          <p>{String(product.name || "SKU detail")}</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/">
            Dashboard
          </Link>
        </div>
      </header>

      <section className="panel">
        <div className="detail-list">
          <div>
            <span>Category</span>
            <strong>{String(product.category || "—")}</strong>
          </div>
          <div>
            <span>Case size</span>
            <strong>{formatNumber(product.case_size)}</strong>
          </div>
          <div>
            <span>Shelf life</span>
            <strong>{formatNumber(product.shelf_life_days)} days</strong>
          </div>
          <div>
            <span>Daily demand</span>
            <strong>{formatNumber(detail.forecast.blended_daily_demand)}</strong>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Demand Trend</h2>
          </div>
          <MultiLineChart series={detail.demand_trend} />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Forecast Models</h2>
          </div>
          <BarChart data={modelRows} labelKey="model" valueKey="daily_demand" />
          <p>{detail.forecast.trend}</p>
          <p>{detail.forecast.seasonality}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Forecast Horizons</h2>
        </div>
        <DataTable columns={["horizon_days", "forecast_quantity", "daily_demand"]} rows={detail.forecast.horizons} />
      </section>

      <section className="panel sku-reorder-actions-panel">
        <div className="panel-header">
          <h2>Reorder Actions</h2>
        </div>
        <SkuReorderActions rows={detail.reorder_recommendations} />
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Inventory Lots</h2>
          </div>
          <DataTable
            columns={[
              "lot_id",
              "warehouse",
              "quantity_on_hand",
              "received_date",
              "expiration_date",
              "unit_cost"
            ]}
            rows={detail.inventory_lots}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>FEFO</h2>
          </div>
          <DataTable
            columns={["warehouse", "ship_first_lot", "expiration_date", "risk_bucket", "suggested_action", "reason"]}
            rows={detail.fefo}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Inbound Shipments</h2>
        </div>
        <DataTable columns={["shipment_id", "quantity", "eta_date", "origin", "status"]} rows={detail.inbound_shipments} />
      </section>
    </>
  );
}
