"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, UploadCloud } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { ForecastValidationResponse, apiGet, formatNumber } from "@/lib/api";

type ValidationState = {
  data: ForecastValidationResponse | null;
  loading: boolean;
  error: string | null;
};

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Needs data";
  return `${Math.round(value * 100)}%`;
}

export default function ForecastValidationPage() {
  const [state, setState] = useState<ValidationState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    apiGet<ForecastValidationResponse>("/api/validation/forecast?horizon_days=30")
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) {
          setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Validation unavailable" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      (state.data?.rows || []).map((row) => ({
        sku: row.sku,
        product_name: row.product_name,
        category: row.category,
        forecast_quantity: row.forecast_quantity,
        actual_quantity: row.actual_quantity,
        error_rate: formatPercent(typeof row.absolute_percentage_error === "number" ? row.absolute_percentage_error : null),
        bias: row.bias,
        confidence: row.confidence,
        business_note: row.business_note,
      })),
    [state.data]
  );

  if (state.loading) {
    return (
      <section className="panel">
        <div className="empty-state">Loading forecast validation</div>
      </section>
    );
  }

  const summary = state.data?.summary;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Forecast Validation</h1>
          <p>Backtest reorder demand forecasts against the most recent 30 days of actual order history.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/imports">
            <UploadCloud size={17} />
            Import buyer data
          </Link>
          <Link className="button" href="/query">
            <Activity size={17} />
            Ask StockSense AI
          </Link>
        </div>
      </header>

      {state.error ? <div className="message error">{state.error}</div> : null}

      <section className="metrics-grid">
        <MetricCard label="SKUs validated" value={formatNumber(summary?.sku_count || 0)} tone="value" />
        <MetricCard label="Weighted forecast error" value={formatPercent(summary?.weighted_absolute_percentage_error)} tone="risk" />
        <MetricCard label="Median SKU error" value={formatPercent(summary?.median_absolute_percentage_error)} tone="stockout" />
        <MetricCard label="Low-confidence SKUs" value={formatNumber(summary?.low_confidence_skus || 0)} tone="reorder" />
      </section>
      <p className="metrics-helper">
        Validation uses a holdout window: forecast from older orders, compare with actual demand in the latest {summary?.horizon_days || 30} days.
      </p>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Buyer Data Accuracy Check</h2>
            <p>Use this before trusting reorder points. High-error rows tell planners where promotions, customer changes, or sparse data need override.</p>
          </div>
        </div>
        <DataTable
          columns={[
            "sku",
            "product_name",
            "category",
            "forecast_quantity",
            "actual_quantity",
            "error_rate",
            "bias",
            "confidence",
            "business_note",
          ]}
          rows={rows}
          emptyLabel="Load buyer orders with at least one holdout window to validate forecast quality."
        />
      </section>
    </>
  );
}
