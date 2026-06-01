"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";

import { API_BASE_URL, IS_DEMO_MODE } from "@/lib/api";

type Requirements = {
  csv_required_columns: Record<string, string[]>;
  erp_adapters: Record<string, string>;
};

const fallbackEntities: Record<string, string[]> = {
  products: ["sku", "name", "category", "case_size", "shelf_life_days"],
  inventory_lots: [
    "lot_id",
    "sku",
    "warehouse",
    "quantity_on_hand",
    "received_date",
    "expiration_date",
    "unit_cost"
  ],
  customers: ["customer_id", "name", "region", "channel"],
  orders: ["order_id", "customer_id", "order_date", "sku", "quantity"],
  inbound_shipments: ["shipment_id", "sku", "quantity", "eta_date", "origin", "status"]
};

export default function ImportsPage() {
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [messages, setMessages] = useState<Record<string, { type: "ok" | "error"; text: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/import/requirements`)
      .then((response) => response.json())
      .then(setRequirements)
      .catch(() => setRequirements({ csv_required_columns: fallbackEntities, erp_adapters: {} }));
  }, []);

  const columns = requirements?.csv_required_columns || fallbackEntities;

  function onFile(entity: string, event: ChangeEvent<HTMLInputElement>) {
    setFiles((current) => ({
      ...current,
      [entity]: event.target.files?.[0] || null
    }));
  }

  async function upload(entity: string) {
    if (IS_DEMO_MODE) {
      setMessages((current) => ({
        ...current,
        [entity]: {
          type: "error",
          text: "CSV uploads are disabled in demo mode until the FastAPI backend is connected."
        }
      }));
      return;
    }

    const file = files[entity];
    if (!file) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: "Choose a CSV file first." }
      }));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading((current) => ({ ...current, [entity]: true }));
    setMessages((current) => ({ ...current, [entity]: { type: "ok", text: "Uploading..." } }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/import/${entity}`, {
        method: "POST",
        body: formData
      });
      const body = await response.json();
      if (!response.ok) {
        const errors = body?.detail?.errors?.join(" ") || body?.detail || "Import failed.";
        throw new Error(errors);
      }
      setMessages((current) => ({
        ...current,
        [entity]: { type: "ok", text: body.message || "Import complete." }
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: error instanceof Error ? error.message : "Import failed." }
      }));
    } finally {
      setLoading((current) => ({ ...current, [entity]: false }));
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>CSV Imports</h1>
          <p>Validated uploads for inventory, demand, customer, and inbound data.</p>
        </div>
      </header>

      <section className="panel">
        {IS_DEMO_MODE ? (
          <div className="message ok">
            Demo mode is active. CSV templates are shown, but uploads require a live FastAPI backend.
          </div>
        ) : null}
        {Object.entries(columns).map(([entity, required]) => (
          <div className="upload-row" key={entity}>
            <div>
              <strong>{entity.replaceAll("_", " ")}</strong>
              <p>{required.join(", ")}</p>
            </div>
            <input className="input" type="file" accept=".csv,text/csv" onChange={(event) => onFile(entity, event)} />
            <button className="button" type="button" disabled={loading[entity]} onClick={() => upload(entity)}>
              <UploadCloud size={17} />
              Upload
            </button>
            {messages[entity] ? (
              <div className={`message ${messages[entity].type}`}>{messages[entity].text}</div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>ERP Adapter Placeholders</h2>
        </div>
        <p>SAP and Oracle adapters share the same field contract and are intentionally connection-free in this MVP.</p>
      </section>
    </>
  );
}
