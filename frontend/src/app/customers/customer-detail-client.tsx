"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { apiGet, formatNumber } from "@/lib/api";

type CustomerDetail = {
  customer: Record<string, unknown> | null;
  summary: Record<string, unknown>;
  top_skus: Record<string, unknown>[];
  monthly_trend: Record<string, unknown>[];
};

export function CustomerDetailClient() {
  const params = useSearchParams();
  const customerId = params.get("customerId") || "CUST-001";
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    apiGet<CustomerDetail>(`/api/customers/${encodeURIComponent(customerId)}`)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load customer detail");
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (error) {
    return <div className="message error">{error}</div>;
  }

  if (!detail) {
    return <div className="empty-state">Loading customer detail</div>;
  }

  const customer = detail.customer || {};

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{String(customer.name || customerId)}</h1>
          <p>
            {String(customer.channel || "Customer")} · {String(customer.region || "Region")}
          </p>
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
            <span>Customer ID</span>
            <strong>{String(customer.customer_id || customerId)}</strong>
          </div>
          <div>
            <span>Total orders</span>
            <strong>{formatNumber(detail.summary.total_orders)}</strong>
          </div>
          <div>
            <span>Total units</span>
            <strong>{formatNumber(detail.summary.total_units)}</strong>
          </div>
          <div>
            <span>Last order</span>
            <strong>{String(detail.summary.last_order_date || "—")}</strong>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Monthly Demand</h2>
          </div>
          <BarChart data={detail.monthly_trend} labelKey="label" valueKey="value" />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Top SKUs</h2>
          </div>
          <DataTable columns={["sku", "name", "category", "quantity"]} rows={detail.top_skus} />
        </div>
      </section>
    </>
  );
}
