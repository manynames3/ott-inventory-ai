"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { FileDown, UploadCloud } from "lucide-react";

import { API_BASE_URL, IS_DEMO_MODE, apiGet, apiPost, apiUpload, authHeaders } from "@/lib/api";

type Requirements = {
  csv_required_columns: Record<string, string[]>;
  erp_adapters: Record<string, string>;
  supported_upload_formats?: string[];
  upload_mode?: "multipart" | "presigned_s3";
  raw_file_storage?: {
    service: string;
    enabled: boolean;
    bucket_configured: boolean;
    bucket?: string;
    prefix: string;
  };
  query_store?: {
    service: string;
    records_table?: string;
    views_table?: string;
  };
};

type UploadResponse = {
  entity: string;
  rows_seen: number;
  rows_imported: number;
  message: string;
  raw_file_storage?: {
    enabled: boolean;
    stored?: {
      service: string;
      bucket: string;
      key: string;
      region: string;
    } | null;
    error?: string | null;
  };
  next_questions?: string[];
};

type PresignResponse = {
  entity: string;
  bucket: string;
  key: string;
  upload_url: string;
  expires_in_seconds: number;
  message: string;
};

type ImportStatus = {
  status: "queued" | "processing" | "imported" | "failed";
  message: string;
  entity?: string;
  rows_imported?: number;
  errors?: string[];
  view_counts?: Record<string, number>;
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
    apiGet<Requirements>("/api/import/requirements")
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

  function sleep(ms: number) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function pollImportStatus(bucket: string, key: string): Promise<ImportStatus> {
    const encodedBucket = encodeURIComponent(bucket);
    const encodedKey = encodeURIComponent(key);
    let lastStatus: ImportStatus = {
      status: "queued",
      message: "Upload received. Import worker has not reported status yet."
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await apiGet<ImportStatus>(`/api/import-status?bucket=${encodedBucket}&key=${encodedKey}`);
      lastStatus = status;
      if (status.status === "imported" || status.status === "failed") {
        return status;
      }
      await sleep(1500);
    }

    return lastStatus;
  }

  function demoTemplateRows(entity: string): Record<string, string | number> {
    const samples: Record<string, Record<string, string | number>> = {
      products: {
        sku: "OTG-RAM-001",
        name: "Golden Kettle Mild Ramyeon Case",
        category: "Noodles",
        case_size: 24,
        shelf_life_days: 270
      },
      inventory_lots: {
        lot_id: "LOT-LA-240601-001",
        sku: "OTG-RAM-001",
        warehouse: "LA DC",
        quantity_on_hand: 840,
        received_date: "2026-04-15",
        expiration_date: "2026-08-30",
        unit_cost: 18.75
      },
      customers: {
        customer_id: "CUST-HMART-WEST",
        name: "H Mart West",
        region: "West",
        channel: "Retail"
      },
      orders: {
        order_id: "ORD-20260531-001",
        customer_id: "CUST-HMART-WEST",
        order_date: "2026-05-31",
        sku: "OTG-RAM-001",
        quantity: 120
      },
      inbound_shipments: {
        shipment_id: "INB-BUSAN-001",
        sku: "OTG-RAM-001",
        quantity: 1800,
        eta_date: "2026-06-28",
        origin: "Busan",
        status: "in_transit"
      }
    };
    return samples[entity] || {};
  }

  async function downloadTemplate(entity: string, format: "csv" | "xlsx") {
    if (IS_DEMO_MODE) {
      const row = demoTemplateRows(entity);
      const headers = columns[entity];
      const csv = `${headers.join(",")}\n${headers.map((header) => row[header] ?? "").join(",")}\n`;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${entity}_template.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/templates/${entity}.${format}`, {
      headers: authHeaders()
    });
    if (!response.ok) {
      throw new Error(`Could not download ${entity} template.`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}_template.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function upload(entity: string) {
    if (IS_DEMO_MODE) {
      setMessages((current) => ({
        ...current,
        [entity]: {
          type: "error",
          text: "Uploads are disabled in demo mode until a live backend is connected."
        }
      }));
      return;
    }

    const file = files[entity];
    if (!file) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: "Choose a CSV or Excel file first." }
      }));
      return;
    }

    setLoading((current) => ({ ...current, [entity]: true }));
    setMessages((current) => ({ ...current, [entity]: { type: "ok", text: "Uploading..." } }));

    try {
      if (requirements?.upload_mode === "presigned_s3") {
        const contentType = file.type || "application/octet-stream";
        const presign = await apiPost<PresignResponse>("/api/uploads/presign", {
          entity,
          filename: file.name,
          content_type: contentType
        });
        setMessages((current) => ({
          ...current,
          [entity]: { type: "ok", text: `Uploading raw file to S3 at ${presign.bucket}/${presign.key}...` }
        }));
        const uploadResponse = await fetch(presign.upload_url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file
        });
        if (!uploadResponse.ok) {
          throw new Error(`S3 upload failed: ${uploadResponse.status}`);
        }
        setMessages((current) => ({
          ...current,
          [entity]: { type: "ok", text: "File uploaded. Validating rows and refreshing insights..." }
        }));
        const status = await pollImportStatus(presign.bucket, presign.key);
        if (status.status === "failed") {
          throw new Error([status.message, ...(status.errors || [])].join(" "));
        }
        const rowsText = status.rows_imported !== undefined ? ` Imported ${status.rows_imported} rows.` : "";
        const countsText = status.view_counts
          ? ` Query views refreshed from ${Object.entries(status.view_counts)
              .map(([name, count]) => `${count} ${name.replaceAll("_", " ")}`)
              .join(", ")}.`
          : "";
        setMessages((current) => ({
          ...current,
          [entity]: {
            type: "ok",
            text: `${status.message}${rowsText}${countsText} Raw file stored in S3 at ${presign.bucket}/${presign.key}.`
          }
        }));
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      const body = await apiUpload<UploadResponse>(`/api/import/${entity}`, formData);
      const stored = body.raw_file_storage?.stored;
      const storageText = stored
        ? ` Raw file stored in ${stored.service.toUpperCase()} at ${stored.bucket}/${stored.key}.`
        : body.raw_file_storage?.enabled
          ? " Raw file storage is configured but did not return an object key."
          : " Raw S3 storage is not configured; rows were imported into the query store.";
      const questionText = body.next_questions?.length
        ? ` Try asking: ${body.next_questions.join(" | ")}`
        : "";
      setMessages((current) => ({
        ...current,
        [entity]: { type: "ok", text: `${body.message || "Import complete."}${storageText}${questionText}` }
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
          <h1>File Imports</h1>
          <p>Validated CSV and Excel exports for products, lots, orders, customers, and inbound containers.</p>
        </div>
      </header>

      <section className="panel">
        {IS_DEMO_MODE ? (
          <div className="message ok">
            Demo mode is active. CSV template downloads work here; Excel templates and uploads require a live backend.
          </div>
        ) : null}
        {requirements?.raw_file_storage ? (
          <div className="message ok">
            Raw Excel/CSV storage: {requirements.raw_file_storage.enabled ? "S3 enabled" : "S3 not configured"}.
            Query speed comes from importing normalized rows into {requirements.query_store?.service || "the query store"} after upload.
          </div>
        ) : null}
        {Object.entries(columns).map(([entity, required]) => (
          <div className="upload-row" key={entity}>
            <div>
              <strong>{entity.replaceAll("_", " ")}</strong>
              <p>{required.join(", ")}</p>
            </div>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => onFile(entity, event)}
            />
            <div className="template-actions">
              <button className="button secondary" type="button" onClick={() => downloadTemplate(entity, "csv")}>
                <FileDown size={16} />
                CSV
              </button>
              {!IS_DEMO_MODE ? (
                <button className="button secondary" type="button" onClick={() => downloadTemplate(entity, "xlsx")}>
                  <FileDown size={16} />
                  Excel
                </button>
              ) : null}
            </div>
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
