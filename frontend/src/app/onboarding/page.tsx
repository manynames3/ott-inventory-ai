"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, FileText, Search, ShieldCheck, UploadCloud } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import {
  ImportChecklistItem,
  ImportHistoryResponse,
  ImportRequirementsResponse,
  apiGet
} from "@/lib/api";

const fallbackColumns: Record<string, string[]> = {
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

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fallbackChecklist(columns: Record<string, string[]>): ImportChecklistItem[] {
  return Object.entries(columns).map(([entity, requiredColumns]) => ({
    entity,
    label: titleCase(entity),
    status: "missing",
    required_columns: requiredColumns,
    message: "Upload this file to activate related insights.",
    rows_imported: 0,
    error_count: 0
  }));
}

function formatDate(epoch?: number) {
  if (!epoch) return "Not loaded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(epoch * 1000);
}

export default function OnboardingPage() {
  const [requirements, setRequirements] = useState<ImportRequirementsResponse | null>(null);
  const [history, setHistory] = useState<ImportHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [requirementsBody, historyBody] = await Promise.all([
          apiGet<ImportRequirementsResponse>("/api/import/requirements"),
          apiGet<ImportHistoryResponse>("/api/import-history?limit=25")
        ]);
        setRequirements(requirementsBody);
        setHistory(historyBody);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onboarding status is not available.");
      }
    }
    void load();
  }, []);

  const columns = requirements?.csv_required_columns || fallbackColumns;
  const checklist = history?.checklist || fallbackChecklist(columns);
  const completeCount = checklist.filter((item) => item.status === "complete").length;
  const missingCount = checklist.length - completeCount;
  const nextDataset = checklist.find((item) => item.status !== "complete");
  const readiness = useMemo(() => {
    if (!checklist.length) return 0;
    return Math.round((completeCount / checklist.length) * 100);
  }, [checklist.length, completeCount]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Data Setup</h1>
          <p>Connect the five operating files needed for trustworthy inventory, reorder, and waste-risk decisions.</p>
        </div>
        <div className="toolbar">
          <Link className="button" href="/imports">
            <UploadCloud size={17} />
            Import files
          </Link>
          <Link className="button secondary" href="/query">
            <Search size={17} />
            Ask StockSense AI
          </Link>
          <a className="button secondary" href="/sample_data/ottogi_demo/products.csv" download>
            <FileText size={17} />
            Sample CSV
          </a>
        </div>
      </header>

      {error ? (
        <section className="panel">
          <div className="message error">{error}</div>
        </section>
      ) : null}

      <section className="grid-3 buyer-value-grid">
        <div className="insight-card compact">
          <span className="insight-icon planner">
            <CheckCircle2 size={18} />
          </span>
          <h2>{readiness}% Ready</h2>
          <p>{completeCount} of {checklist.length} datasets are available for recommendations.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon stockout">
            <CircleAlert size={18} />
          </span>
          <h2>{missingCount} Remaining</h2>
          <p>{nextDataset ? `${nextDataset.label} is the next file to load.` : "All required datasets are ready for review."}</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon waste">
            <ShieldCheck size={18} />
          </span>
          <h2>Workspace Controls</h2>
          <p>Preview mappings, validate rows, and retain an audit trail before trusting the recommendations.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Dataset Readiness</h2>
            <p>StockSense needs product master, lot-level inventory, customers, orders, and inbound supply.</p>
          </div>
        </div>
        <div className="checklist-grid">
          {checklist.map((item) => (
            <div className={`checklist-item checklist-${item.status}`} key={item.entity}>
              <span>{item.status === "complete" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.message}</p>
                <small>
                  {item.rows_imported ? `${item.rows_imported.toLocaleString()} rows imported` : "Waiting for upload"}
                  {item.error_count ? ` - ${item.error_count} validation errors` : ""}
                  {` - ${formatDate(item.updated_at_epoch)}`}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Operating Workflow</h2>
              <p>The fastest path from files to a weekly operations review.</p>
            </div>
          </div>
          <div className="pilot-step-list">
            {[
              ["1", "Import", "Upload CSV or Excel files, preview mappings, then approve the import."],
              ["2", "Validate", "Review row counts, validation errors, and audit events before using the output."],
              [
                "3",
                "Act",
                "Open the priority queue to review reorder, FEFO (First Expired, First Out), and waste-risk decisions."
              ],
              ["4", "Explain", "Use the query page to ask natural-language questions over the refreshed views."]
            ].map(([step, title, body]) => (
              <div className="pilot-step" key={step}>
                <span>{step}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Import Contract</h2>
              <p>Fields expected from ERP exports or operating spreadsheets.</p>
            </div>
          </div>
          <div className="contract-list">
            {Object.entries(columns).map(([entity, requiredColumns]) => (
              <div key={entity}>
                <div>
                  <strong>{titleCase(entity)}</strong>
                  <StatusPill value={`${requiredColumns.length} fields`} />
                </div>
                <p>{requiredColumns.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Next Evaluation Step</h2>
            <p>
              Once the five files are loaded, a planner should be able to validate recommended buys, expiring-lot
              actions, and stockout risks without engineering help.
            </p>
          </div>
          <div className="toolbar">
            <Link className="button secondary" href="/security">
              <FileText size={17} />
              Data handling
            </Link>
            <Link className="button" href="/actions">
              Review actions
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Starter Files</h2>
            <p>Use these sample files to understand format expectations before loading internal exports.</p>
          </div>
        </div>
        <div className="template-actions">
          {Object.keys(columns).map((entity) => (
            <a className="button secondary" href={`/sample_data/ottogi_demo/${entity}.csv`} download key={entity}>
              <FileText size={16} />
              {titleCase(entity)}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
