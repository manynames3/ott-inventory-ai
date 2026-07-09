"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { CheckCheck, CheckCircle2, CircleAlert, Clock, Eye, FileDown, RefreshCw, ShieldCheck } from "lucide-react";

import { DataTable } from "@/components/data-table";
import {
  AuditEventsResponse,
  AuditEventRow,
  IS_DEMO_MODE,
  ImportCommitResponse,
  ImportChecklistItem,
  ImportHistoryResponse,
  ImportHistoryRow,
  ImportPreviewResponse,
  ImportRequirementsResponse,
  apiDownload,
  apiGet,
  apiPost,
  apiUpload
} from "@/lib/api";

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
  mode?: "import" | "preview";
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

type ImportProgress = {
  step: "selected" | "uploading" | "mapping" | "queued" | "refreshing" | "complete" | "failed";
  message: string;
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
  const [requirements, setRequirements] = useState<ImportRequirementsResponse | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [messages, setMessages] = useState<Record<string, { type: "ok" | "error" | "warning"; text: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<ImportHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, ImportPreviewResponse | null>>({});
  const [mappings, setMappings] = useState<Record<string, Record<string, string>>>({});
  const [audit, setAudit] = useState<AuditEventsResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ImportProgress | null>>({});
  const [requirementsError, setRequirementsError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ImportRequirementsResponse>("/api/import/requirements")
      .then((body) => {
        setRequirements(body);
        setRequirementsError(null);
      })
      .catch((error) => {
        setRequirements({ csv_required_columns: fallbackEntities, erp_adapters: {} });
        setRequirementsError(error instanceof Error ? error.message : "Import requirements are unavailable.");
      });
    void loadHistory();
    void loadAudit();
  }, []);

  const columns = requirements?.csv_required_columns || fallbackEntities;
  const checklist = history?.checklist || fallbackChecklist(columns);
  const failedImports = (history?.rows || []).filter((row) => row.status === "failed");
  const historyRows = (history?.rows || []).map(formatHistoryRow);
  const auditRows = (audit?.rows || []).map(formatAuditRow);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const body = await apiGet<ImportHistoryResponse>("/api/import-history?limit=100");
      setHistory(body);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Import history is not available.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadAudit() {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const body = await apiGet<AuditEventsResponse>("/api/audit-events?limit=75");
      setAudit(body);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "Audit trail is not available.");
    } finally {
      setAuditLoading(false);
    }
  }

  function onFile(entity: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (file) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      const allowed = requirements?.supported_upload_formats || [".csv", ".xlsx", ".xlsm"];
      const maxBytes = requirements?.upload_mode === "presigned_s3" ? 100 * 1024 * 1024 : 8 * 1024 * 1024;
      if (!allowed.includes(extension)) {
        event.target.value = "";
        setFiles((current) => ({ ...current, [entity]: null }));
        setMessages((current) => ({
          ...current,
          [entity]: { type: "error", text: `Choose a supported file: ${allowed.join(", ")}.` }
        }));
        setProgress((current) => ({ ...current, [entity]: { step: "failed", message: "Unsupported file type." } }));
        return;
      }
      if (!file.size) {
        event.target.value = "";
        setFiles((current) => ({ ...current, [entity]: null }));
        setMessages((current) => ({ ...current, [entity]: { type: "error", text: "The selected file is empty." } }));
        setProgress((current) => ({ ...current, [entity]: { step: "failed", message: "Empty file." } }));
        return;
      }
      if (file.size > maxBytes) {
        event.target.value = "";
        setFiles((current) => ({ ...current, [entity]: null }));
        setMessages((current) => ({
          ...current,
          [entity]: { type: "error", text: `This file exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.` }
        }));
        setProgress((current) => ({ ...current, [entity]: { step: "failed", message: "File is too large." } }));
        return;
      }
    }
    setFiles((current) => ({
      ...current,
      [entity]: file
    }));
    setPreviews((current) => ({ ...current, [entity]: null }));
    setMappings((current) => ({ ...current, [entity]: {} }));
    setMessages((current) => {
      const next = { ...current };
      delete next[entity];
      return next;
    });
    setProgress((current) => ({
      ...current,
      [entity]: file ? { step: "selected", message: `${file.name} selected. Preview the file before import.` } : null
    }));
  }

  function sleep(ms: number) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function fallbackChecklist(currentColumns: Record<string, string[]>): ImportChecklistItem[] {
    return Object.entries(currentColumns).map(([entity, required]) => ({
      entity,
      label: entity.replaceAll("_", " "),
      status: "missing",
      required_columns: required,
      message: "Not loaded",
      rows_imported: 0,
      error_count: 0
    }));
  }

  function formatDate(epoch?: number) {
    if (!epoch) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(epoch * 1000);
  }

  function formatHistoryRow(row: ImportHistoryRow): Record<string, unknown> {
    return {
      entity: row.entity || "",
      status: row.status || "queued",
      rows_imported: row.rows_imported,
      rows_seen: row.rows_seen,
      filename: row.filename || row.key?.split("/").pop() || "",
      updated_at: formatDate(row.updated_at_epoch),
      message: row.message || "",
      errors: row.errors?.join(" | ") || ""
    };
  }

  function formatAuditRow(row: AuditEventRow): Record<string, unknown> {
    return {
      time: formatDate(row.created_at_epoch),
      user: row.user,
      action: row.action.replaceAll("_", " "),
      resource: row.resource,
      origin: row.origin || "",
      details: row.details
        ? Object.entries(row.details)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(" | ")
        : ""
    };
  }

  function mappedPreviewRows(entity: string): Record<string, unknown>[] {
    const preview = previews[entity];
    if (!preview) return [];
    const mapping = mappings[entity] || preview.suggested_mapping;
    return preview.sample_rows.map((row) =>
      Object.fromEntries(preview.required_columns.map((column) => [column, row[mapping[column]] ?? ""]))
    );
  }

  function missingMappings(entity: string): string[] {
    const preview = previews[entity];
    if (!preview) return [];
    const mapping = mappings[entity] || {};
    return preview.required_columns.filter((column) => !mapping[column]);
  }

  function setMapping(entity: string, targetColumn: string, sourceColumn: string) {
    setMappings((current) => ({
      ...current,
      [entity]: {
        ...(current[entity] || {}),
        [targetColumn]: sourceColumn
      }
    }));
  }

  function checklistIcon(status: ImportChecklistItem["status"]) {
    if (status === "complete") return <CheckCircle2 size={18} />;
    if (status === "needs_fix") return <CircleAlert size={18} />;
    return <Clock size={18} />;
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
        sku: "08252K",
        name: "Ottogi Jin Ramen Hot Case",
        category: "Noodles",
        case_size: 20,
        shelf_life_days: 270
      },
      inventory_lots: {
        lot_id: "LOT-LA-240601-001",
        sku: "08252K",
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
        sku: "08252K",
        quantity: 120
      },
      inbound_shipments: {
        shipment_id: "INB-BUSAN-001",
        sku: "08252K",
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

    const blob = await apiDownload(`/api/templates/${entity}.${format}`);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}_template.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function downloadExport(entity: string) {
    let blob: Blob;
    if (IS_DEMO_MODE) {
      const response = await fetch(`/sample_data/ottogi_demo/${entity}.csv`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not download ${entity} export.`);
      blob = await response.blob();
    } else {
      blob = await apiDownload(`/api/exports/${entity}.csv`);
    }
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${entity}_export.csv`;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  async function runDownload(entity: string, label: string, action: () => Promise<void>) {
    setMessages((current) => ({ ...current, [entity]: { type: "ok", text: `Preparing ${label}...` } }));
    try {
      await action();
      setMessages((current) => ({ ...current, [entity]: { type: "ok", text: `${label} downloaded.` } }));
    } catch (error) {
      const message = error instanceof TypeError
        ? `${label} could not be reached. Check your connection and try again.`
        : error instanceof Error
          ? error.message
          : `${label} could not be downloaded.`;
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: message }
      }));
    }
  }

  async function previewImport(entity: string) {
    if (IS_DEMO_MODE) {
      setMessages((current) => ({
        ...current,
        [entity]: {
          type: "error",
          text: "Mapping previews and imports require the live backend."
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
    setMessages((current) => ({ ...current, [entity]: { type: "ok", text: "Uploading file for mapping preview..." } }));
    setProgress((current) => ({
      ...current,
      [entity]: { step: "uploading", message: "Uploading file for mapping preview." }
    }));

    try {
      if (requirements?.upload_mode === "presigned_s3") {
        const contentType = file.type || "application/octet-stream";
        const presign = await apiPost<PresignResponse>("/api/uploads/presign", {
          entity,
          filename: file.name,
          content_type: contentType,
          mode: "preview"
        });
        setMessages((current) => ({
          ...current,
          [entity]: { type: "ok", text: `Uploading preview file to S3 at ${presign.bucket}/${presign.key}...` }
        }));
        setProgress((current) => ({
          ...current,
          [entity]: { step: "uploading", message: "Uploading preview file to private storage." }
        }));
        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(presign.upload_url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file
          });
        } catch {
          throw new Error("The file could not be uploaded. Check your connection and try again.");
        }
        if (!uploadResponse.ok) {
          throw new Error(`S3 upload failed: ${uploadResponse.status}`);
        }
        setMessages((current) => ({
          ...current,
          [entity]: { type: "ok", text: "File uploaded. Detecting columns and validating sample rows..." }
        }));
        setProgress((current) => ({
          ...current,
          [entity]: { step: "mapping", message: "Detecting columns and validating sample rows." }
        }));
        const preview = await apiPost<ImportPreviewResponse>("/api/import-preview", {
          entity,
          bucket: presign.bucket,
          key: presign.key,
          filename: file.name
        });
        setPreviews((current) => ({ ...current, [entity]: preview }));
        setMappings((current) => ({ ...current, [entity]: preview.suggested_mapping }));
        const mappingText = preview.validation.missing_mappings.length
          ? ` Map ${preview.validation.missing_mappings.join(", ")} before importing.`
          : " Mapping is ready to approve.";
        const errorText = preview.validation.sample_errors.length
          ? ` Sample validation warnings: ${preview.validation.sample_errors.slice(0, 2).join(" ")}`
          : "";
        setMessages((current) => ({
          ...current,
          [entity]: {
            type: "ok",
            text: `Previewed ${preview.row_count_estimate.toLocaleString()} rows and ${preview.detected_columns.length} detected columns.${mappingText}${errorText}`
          }
        }));
        setProgress((current) => ({
          ...current,
          [entity]: {
            step: preview.validation.missing_mappings.length ? "mapping" : "complete",
            message: preview.validation.missing_mappings.length
              ? "Map the missing fields before import."
              : "Mapping preview is ready for approval."
          }
        }));
        void loadAudit();
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      const body = await apiUpload<UploadResponse>(`/api/import/${entity}`, formData);
      setMessages((current) => ({
        ...current,
        [entity]: { type: "ok", text: body.message || "Import complete." }
      }));
      setProgress((current) => ({
        ...current,
        [entity]: { step: "complete", message: body.message || "Import complete." }
      }));
      void loadHistory();
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: error instanceof Error ? error.message : "Import failed." }
      }));
      setProgress((current) => ({
        ...current,
        [entity]: { step: "failed", message: error instanceof Error ? error.message : "Import failed." }
      }));
      void loadHistory();
    } finally {
      setLoading((current) => ({ ...current, [entity]: false }));
    }
  }

  async function commitImport(entity: string) {
    const preview = previews[entity];
    if (!preview) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: "Preview and map this file before importing." }
      }));
      return;
    }
    const missing = missingMappings(entity);
    if (missing.length) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: `Map required columns first: ${missing.join(", ")}.` }
      }));
      return;
    }
    if (preview.validation.sample_errors.length) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: "Resolve the sample validation errors before approving this import." }
      }));
      return;
    }
    setLoading((current) => ({ ...current, [entity]: true }));
    setMessages((current) => ({
      ...current,
      [entity]: { type: "ok", text: "Approving mapping and queueing the import worker..." }
    }));
    setProgress((current) => ({
      ...current,
      [entity]: { step: "queued", message: "Mapping approved. Import worker queued." }
    }));
    try {
      const body = await apiPost<ImportCommitResponse>("/api/imports/commit", {
        entity,
        bucket: preview.bucket,
        key: preview.key,
        mapping: mappings[entity]
      });
      const status = await pollImportStatus(body.bucket, body.key);
      if (status.status === "queued" || status.status === "processing") {
        setMessages((current) => ({
          ...current,
          [entity]: {
            type: "warning",
            text: "The import is still processing. It remains queued safely; refresh import history in a moment for the final result."
          }
        }));
        setProgress((current) => ({
          ...current,
          [entity]: { step: "queued", message: "Import is still processing in the background." }
        }));
        void loadHistory();
        return;
      }
      setProgress((current) => ({
        ...current,
        [entity]: { step: "refreshing", message: "Import worker reported back. Refreshing views and history." }
      }));
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
        [entity]: { type: "ok", text: `${status.message}${rowsText}${countsText}` }
      }));
      setProgress((current) => ({
        ...current,
        [entity]: { step: "complete", message: `${status.message}${rowsText}` }
      }));
      setPreviews((current) => ({ ...current, [entity]: null }));
      setMappings((current) => ({ ...current, [entity]: {} }));
      void loadHistory();
      void loadAudit();
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [entity]: { type: "error", text: error instanceof Error ? error.message : "Import failed." }
      }));
      setProgress((current) => ({
        ...current,
        [entity]: { step: "failed", message: error instanceof Error ? error.message : "Import failed." }
      }));
      void loadHistory();
      void loadAudit();
    } finally {
      setLoading((current) => ({ ...current, [entity]: false }));
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>File Imports</h1>
          <p>Products, lots, orders, customers, and inbound shipments.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={loadHistory} disabled={historyLoading}>
            <RefreshCw size={17} />
            Refresh history
          </button>
        </div>
      </header>

      {requirementsError ? <div className="message warning" role="alert">Import configuration could not be verified: {requirementsError}</div> : null}
      {IS_DEMO_MODE ? (
        <div className="message info" role="status">
          File uploads are disabled in the demo workspace. You can download the sample exports and templates below; sign in to a live workspace to import operational data.
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Data Status</h2>
          </div>
        </div>
        <div className="checklist-grid">
          {checklist.map((item) => (
            <div className={`checklist-item checklist-${item.status}`} key={item.entity}>
              <span>{checklistIcon(item.status)}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.message}</p>
                <small>
                  {item.rows_imported ? `${item.rows_imported.toLocaleString()} rows` : "Waiting for upload"}
                  {item.error_count ? ` - ${item.error_count} validation errors` : ""}
                  {item.updated_at_epoch ? ` - ${formatDate(item.updated_at_epoch)}` : ""}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        {Object.entries(columns).map(([entity, required]) => {
          const preview = previews[entity];
          const missing = missingMappings(entity);
          return (
          <div className="upload-row" key={entity}>
            <label className="upload-file-label" htmlFor={`import-file-${entity}`}>
              <strong>{entity.replaceAll("_", " ")}</strong>
              <p>{required.join(", ")}</p>
            </label>
            <input
              id={`import-file-${entity}`}
              className="input"
              type="file"
              accept=".csv,text/csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => onFile(entity, event)}
              disabled={IS_DEMO_MODE}
            />
            <div className="template-actions">
              <button className="button secondary" type="button" onClick={() => void runDownload(entity, "CSV export", () => downloadExport(entity))}>
                <FileDown size={16} />
                Export CSV
              </button>
              <button className="button secondary" type="button" onClick={() => void runDownload(entity, "CSV template", () => downloadTemplate(entity, "csv"))}>
                <FileDown size={16} />
                CSV Template
              </button>
              {!IS_DEMO_MODE ? (
                <button className="button secondary" type="button" onClick={() => void runDownload(entity, "Excel template", () => downloadTemplate(entity, "xlsx"))}>
                  <FileDown size={16} />
                  Excel Template
                </button>
              ) : null}
            </div>
            <button className="button" type="button" disabled={IS_DEMO_MODE || loading[entity] || !files[entity]} onClick={() => previewImport(entity)}>
              <Eye size={17} />
              {loading[entity] ? "Working..." : "Preview file"}
            </button>
            {progress[entity] ? (
              <div className={`import-progress import-progress-${progress[entity]?.step}`}>
                <strong>{progress[entity]?.step.replaceAll("_", " ")}</strong>
                <span>{progress[entity]?.message}</span>
              </div>
            ) : null}
            {preview ? (
              <div className="mapping-panel">
                <div className="panel-header">
                  <div>
                    <h3>Mapping Preview</h3>
                    <p>{preview.row_count_estimate.toLocaleString()} rows detected from {preview.filename}.</p>
                  </div>
                  <button
                    className="button"
                    type="button"
                    disabled={loading[entity] || missing.length > 0 || preview.validation.sample_errors.length > 0}
                    onClick={() => commitImport(entity)}
                  >
                    <CheckCheck size={17} />
                    Approve import
                  </button>
                </div>
                <div className="column-list">
                  <span>Detected columns</span>
                  <p>{preview.detected_columns.join(", ") || "No columns detected"}</p>
                </div>
                <div className="mapping-grid">
                  {preview.required_columns.map((column) => (
                    <label key={column}>
                      <span>{column.replaceAll("_", " ")}</span>
                      <select
                        className="input"
                        value={(mappings[entity] || {})[column] || ""}
                        onChange={(event) => setMapping(entity, column, event.target.value)}
                      >
                        <option value="">Not mapped</option>
                        {preview.detected_columns.map((sourceColumn) => (
                          <option value={sourceColumn} key={sourceColumn}>
                            {sourceColumn}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {missing.length ? (
                  <div className="message error">Missing mappings: {missing.join(", ")}</div>
                ) : preview.validation.sample_errors.length ? (
                  <div className="message error">{preview.validation.sample_errors.slice(0, 4).join(" ")}</div>
                ) : (
                  <div className="message ok">Sample rows validated.</div>
                )}
                <DataTable
                  columns={preview.required_columns}
                  rows={mappedPreviewRows(entity)}
                  emptyLabel="No sample rows are available"
                />
              </div>
            ) : null}
            {messages[entity] ? (
              <div className={`message ${messages[entity].type}`} role={messages[entity].type === "error" ? "alert" : "status"}>{messages[entity].text}</div>
            ) : null}
          </div>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Import History And Validation</h2>
          </div>
        </div>
        {historyError ? <div className="message error">{historyError}</div> : null}
        <DataTable
          columns={["entity", "status", "rows_imported", "rows_seen", "filename", "updated_at", "message", "errors"]}
          rows={historyRows}
          emptyLabel={historyLoading ? "Loading import history" : "No imports have been processed yet"}
        />
      </section>

      {failedImports.length ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Validation Errors To Fix</h2>
            </div>
          </div>
          <div className="validation-list">
            {failedImports.map((row, index) => (
              <div className="validation-card" key={`${row.key || row.filename || row.entity}-${index}`}>
                <h3>{row.entity?.replaceAll("_", " ") || "Import file"}</h3>
                <p>{row.message || "Import failed validation."}</p>
                <ul>
                  {(row.errors?.length ? row.errors : ["No row-level error detail was returned."]).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Audit Trail</h2>
          </div>
          <button className="button secondary" type="button" onClick={loadAudit} disabled={auditLoading}>
            <ShieldCheck size={17} />
            Refresh audit
          </button>
        </div>
        {auditError ? <div className="message error">{auditError}</div> : null}
        <DataTable
          columns={["time", "user", "action", "resource", "origin", "details"]}
          rows={auditRows}
          emptyLabel={auditLoading ? "Loading audit trail" : "No audit events yet"}
        />
      </section>

    </>
  );
}
