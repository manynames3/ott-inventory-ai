"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageError, PageLoading } from "@/components/feedback";
import { apiGet, formatNumber } from "@/lib/api";

type CustomerDetail = {
  customer: Record<string, unknown> | null;
  summary: Record<string, unknown>;
  top_skus: Record<string, unknown>[];
  monthly_trend: Record<string, unknown>[];
};

export function CustomerDetailClient() {
  const params = useSearchParams();
  const customerId = params.get("customerId")?.trim() || "";
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedCustomerId, setLoadedCustomerId] = useState("");

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    apiGet<CustomerDetail>(`/api/customers/${encodeURIComponent(customerId)}`)
      .then((response) => {
        if (active) {
          setDetail(response);
          setError(null);
          setLoadedCustomerId(customerId);
        }
      })
      .catch((err) => {
        if (active) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Could not load customer detail");
          setLoadedCustomerId(customerId);
        }
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (!customerId) {
    return (
      <>
        <header className="page-header">
          <div>
            <h1>Customer detail</h1>
            <p>Open a customer from search or an inventory table.</p>
          </div>
        </header>
        <EmptyState
          title="No customer selected"
          message="Choose a customer to review order activity, monthly demand, and top SKUs."
          action={<Link className="button" href="/">Back to overview</Link>}
        />
      </>
    );
  }

  if (loadedCustomerId !== customerId) return <PageLoading label="Loading customer detail" />;

  if (error) {
    return <PageError title="Customer could not be loaded" message={error} action={<Link className="button secondary" href="/">Back to overview</Link>} />;
  }

  if (!detail) {
    return <PageLoading label="Loading customer detail" />;
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
