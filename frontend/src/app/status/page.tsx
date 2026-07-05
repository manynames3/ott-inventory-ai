"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, BrainCircuit, Database, LockKeyhole, Server, ShieldCheck, UploadCloud } from "lucide-react";

import {
  API_BASE_URL,
  AiStatusResponse,
  AuthMeResponse,
  HealthResponse,
  IS_DEMO_MODE,
  ImportRequirementsResponse,
  MonitoringSummaryResponse,
  apiGet,
  authHeaders
} from "@/lib/api";

type Loadable<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

function empty<T>(): Loadable<T> {
  return { data: null, error: null, loading: true };
}

function statusLabel(item: Loadable<unknown>, ready: boolean) {
  if (item.loading) return "checking";
  if (item.error) return "attention";
  return ready ? "online" : "needs setup";
}

function statusClass(label: string) {
  if (label === "online") return "system-ok";
  if (label === "demo") return "system-demo";
  if (label === "checking") return "system-checking";
  return "system-warning";
}

export default function StatusPage() {
  const [health, setHealth] = useState<Loadable<HealthResponse>>(empty());
  const [auth, setAuth] = useState<Loadable<AuthMeResponse>>(empty());
  const [ai, setAi] = useState<Loadable<AiStatusResponse>>(empty());
  const [requirements, setRequirements] = useState<Loadable<ImportRequirementsResponse>>(empty());
  const [monitoring, setMonitoring] = useState<Loadable<MonitoringSummaryResponse>>(empty());

  useEffect(() => {
    async function fetchJson<T>(path: string): Promise<T> {
      if (IS_DEMO_MODE) {
        return apiGet<T>(path);
      }
      const response = await fetch(`${API_BASE_URL}${path}`, {
        cache: "no-store",
        headers: authHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json() as Promise<T>;
    }

    async function loadOne<T>(path: string, setter: (value: Loadable<T>) => void) {
      setter({ data: null, error: null, loading: true });
      try {
        const data = await fetchJson<T>(path);
        setter({ data, error: null, loading: false });
      } catch (err) {
        setter({ data: null, error: err instanceof Error ? err.message : "Unavailable", loading: false });
      }
    }

    void loadOne<HealthResponse>("/health", setHealth);
    void loadOne<AuthMeResponse>("/api/auth/me", setAuth);
    void loadOne<AiStatusResponse>("/api/ai/status", setAi);
    void loadOne<ImportRequirementsResponse>("/api/import/requirements", setRequirements);
    void loadOne<MonitoringSummaryResponse>("/api/monitoring/summary", setMonitoring);
  }, []);

  const backendLabel = IS_DEMO_MODE ? "demo" : statusLabel(health, Boolean(health.data?.ok));
  const authLabel = IS_DEMO_MODE ? "demo" : statusLabel(auth, Boolean(auth.data?.user?.username));
  const aiLabel = ai.loading
    ? "checking"
    : ai.error
      ? "attention"
      : ai.data?.configured && ai.data?.enabled
        ? "online"
        : "fallback";
  const importLabel = IS_DEMO_MODE
    ? "demo"
    : statusLabel(requirements, Boolean(requirements.data?.raw_file_storage?.bucket_configured));
  const queryStoreLabel = IS_DEMO_MODE
    ? "demo"
    : requirements.loading
      ? "checking"
      : requirements.error
        ? "attention"
        : "online";

  return (
    <>
      <header className="page-header">
        <div>
          <h1>System Status</h1>
          <p>Operational checks for frontend mode, backend reachability, login, imports, monitoring, and AI fallback.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/security">
            <LockKeyhole size={17} />
            Security
          </Link>
          <Link className="button secondary" href="/audit">
            <ShieldCheck size={17} />
            Audit
          </Link>
          <Link className="button" href="/imports">
            <UploadCloud size={17} />
            Import CSV
          </Link>
        </div>
      </header>

      <section className="system-status-grid">
        <div className="system-status-card">
          <span className="system-status-icon">
            <Activity size={18} />
          </span>
          <div>
            <p>Frontend</p>
            <h2>Cloudflare Pages-ready</h2>
            <small>{IS_DEMO_MODE ? "Demo mode with bundled sample-data fallback" : "Live API mode"}</small>
            <strong className="system-ok">online</strong>
          </div>
        </div>

        <div className="system-status-card">
          <span className="system-status-icon">
            <Server size={18} />
          </span>
          <div>
            <p>Backend API</p>
            <h2>{IS_DEMO_MODE ? "Demo data fallback" : health.data?.service || "StockSense API"}</h2>
            <small>
              {IS_DEMO_MODE
                ? "Demo mode is using bundled sample data; live API checks are used when demo mode is off."
                : health.error || "Lambda/FastAPI health endpoint responded."}
            </small>
            <strong className={statusClass(backendLabel)}>{backendLabel}</strong>
          </div>
        </div>

        <div className="system-status-card">
          <span className="system-status-icon">
            <LockKeyhole size={18} />
          </span>
          <div>
            <p>Login</p>
            <h2>{IS_DEMO_MODE ? "Demo session" : auth.data?.user?.username || "Workspace user"}</h2>
            <small>
              {IS_DEMO_MODE
                ? "Demo pages do not require named-user credentials."
                : auth.error
                  ? "Sign in to view protected API checks."
                  : `Tenant: ${auth.data?.user?.tenant_id || health.data?.tenant_id || "default"} · Role: ${
                    auth.data?.user?.role || "planner"
                  }`}
            </small>
            <strong className={statusClass(authLabel)}>{authLabel}</strong>
          </div>
        </div>

        <div className="system-status-card">
          <span className="system-status-icon">
            <BrainCircuit size={18} />
          </span>
          <div>
            <p>AI Layer</p>
            <h2>{IS_DEMO_MODE ? "Rule-based demo answers" : ai.data?.mode?.replaceAll("_", " ") || "Safe query mode"}</h2>
            <small>
              {IS_DEMO_MODE
                ? "Natural-language questions use safe demo templates unless a live AI key is configured."
                : ai.error ||
                  `${ai.data?.provider || "openai"} ${ai.data?.model || ""} ${
                    ai.data?.configured ? "configured" : "not configured; deterministic fallback is active"
                  }`}
            </small>
            <strong className={statusClass(aiLabel)}>{aiLabel}</strong>
          </div>
        </div>

        <div className="system-status-card">
          <span className="system-status-icon">
            <Database size={18} />
          </span>
          <div>
            <p>Import Storage</p>
            <h2>
              {IS_DEMO_MODE
                ? "Demo sample files"
                : `${requirements.data?.raw_file_storage?.service?.toUpperCase() || "S3"} raw uploads`}
            </h2>
            <small>
              {IS_DEMO_MODE
                ? "Live S3 upload storage is used after backend credentials and tenant config are enabled."
                : requirements.error || `Prefix: ${requirements.data?.raw_file_storage?.prefix || "not configured"}`}
            </small>
            <strong className={statusClass(importLabel)}>{importLabel}</strong>
          </div>
        </div>

        <div className="system-status-card">
          <span className="system-status-icon">
            <Database size={18} />
          </span>
          <div>
            <p>Query Store</p>
            <h2>{IS_DEMO_MODE ? "Bundled demo views" : requirements.data?.query_store?.service?.toUpperCase() || "Materialized views"}</h2>
            <small>
              {IS_DEMO_MODE
                ? "Dashboard and query answers are served from the included Ottogi-style sample dataset."
                : requirements.data?.query_store?.views_table || "Views refresh after import commits."}
            </small>
            <strong className={statusClass(queryStoreLabel)}>{queryStoreLabel}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Retention And SIEM</h2>
            <p>Runtime policy values reported by the backend for audit, import, and raw-upload handling.</p>
          </div>
        </div>
        <div className="system-status-grid compact-status-grid">
          <div className="system-status-card">
            <span className="system-status-icon">
              <Database size={18} />
            </span>
            <div>
              <p>Raw uploads</p>
              <h2>{requirements.data?.retention?.raw_upload_days?.toLocaleString() || "365"} days</h2>
              <small>Private S3 lifecycle retention for uploaded CSV/XLSX files.</small>
              <strong className="system-ok">configured</strong>
            </div>
          </div>
          <div className="system-status-card">
            <span className="system-status-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p>Audit events</p>
              <h2>{requirements.data?.retention?.audit_event_days?.toLocaleString() || "180"} days</h2>
              <small>Operational audit table retention before immutable archive export.</small>
              <strong className="system-ok">configured</strong>
            </div>
          </div>
          <div className="system-status-card">
            <span className="system-status-icon">
              <UploadCloud size={18} />
            </span>
            <div>
              <p>Import history</p>
              <h2>{requirements.data?.retention?.import_status_days?.toLocaleString() || "90"} days</h2>
              <small>Import validation and status history retention.</small>
              <strong className="system-ok">configured</strong>
            </div>
          </div>
          <div className="system-status-card">
            <span className="system-status-icon">
              <Activity size={18} />
            </span>
            <div>
              <p>SIEM</p>
              <h2>{requirements.data?.siem?.configured ? "Forwarder configured" : "Archive-ready"}</h2>
              <small>{requirements.data?.siem?.mode?.replaceAll("_", " ") || "S3 archive or customer forwarder"}</small>
              <strong className={statusClass(requirements.data?.siem?.configured ? "online" : "needs setup")}>
                {requirements.data?.siem?.configured ? "online" : "needs setup"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Monitoring Summary</h2>
            <p>Last 24 hours: API errors, import failures, slow jobs, and failed AI calls.</p>
          </div>
        </div>
        {monitoring.error ? <div className="message warning">Monitoring summary is unavailable: {monitoring.error}</div> : null}
        <div className="system-status-grid compact-status-grid">
          {(monitoring.data?.checks || []).map((check) => (
            <div className="system-status-card" key={check.name}>
              <span className="system-status-icon">
                <Activity size={18} />
              </span>
              <div>
                <p>{check.name}</p>
                <h2>{check.count.toLocaleString()} events</h2>
                <small>{check.message}</small>
                <strong className={statusClass(check.status === "ok" ? "online" : "attention")}>
                  {check.status === "ok" ? "ok" : "attention"}
                </strong>
              </div>
            </div>
          ))}
        </div>
        {monitoring.data?.events?.length ? (
          <div className="runtime-list monitoring-events">
            {monitoring.data.events.slice(0, 5).map((event, index) => (
              <div key={`${event.action || event.event_type || event.status || "event"}-${index}`}>
                <span>{event.action || event.event_type || event.status || "event"}</span>
                <p>{event.message || event.resource || event.user || "Recent monitoring event"}</p>
              </div>
            ))}
          </div>
        ) : monitoring.loading ? (
          <div className="empty-state">Checking monitoring signals</div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Current Runtime Shape</h2>
            <p>
              This workspace is optimized for low idle cost: static frontend, serverless API, private raw-file storage,
              and materialized operational views for fast natural-language answers.
            </p>
          </div>
        </div>
        <div className="runtime-list">
          <div>
            <span>Frontend URL</span>
            <p>https://otokistocksense.pages.dev</p>
          </div>
          <div>
            <span>API Base URL</span>
            <p>{IS_DEMO_MODE ? `Demo fallback active. Live API base is configured as ${API_BASE_URL}.` : API_BASE_URL}</p>
          </div>
          <div>
            <span>Import Workflow</span>
            <p>{requirements.data?.import_workflow?.replaceAll("_", " ") || "preview, map, approve import"}</p>
          </div>
          <div>
            <span>Scheduled Imports</span>
            <p>
              {requirements.data?.scheduled_imports?.enabled
                ? `${requirements.data.scheduled_imports.mode?.replaceAll("_", " ") || "scheduled S3 scan"}: ${
                  requirements.data.scheduled_imports.prefixes?.join(", ") || "configured prefixes"
                }`
                : "Manual upload flow only in this runtime."}
            </p>
          </div>
          <div>
            <span>Authentication Mode</span>
            <p>
              {requirements.data?.auth?.cognito_ready
                ? "Secure hosted login is configured; workspace roles map to planner, approver, and admin access."
                : "Password/JWT workspace auth is active."}
            </p>
          </div>
          <div>
            <span>Planner Review Storage</span>
            <p>
              {IS_DEMO_MODE
                ? "Browser-local for the public demo; server persistence is enabled in live API mode."
                : "Server-backed action review API with browser fallback if sync is interrupted."}
            </p>
          </div>
          <div>
            <span>Audit Visibility</span>
            <p>
              Login, import, query, export, and planner-review events are available from the Audit page.
              {requirements.data?.audit?.immutable_archive_configured ? " Immutable archive is configured." : ""}
              {requirements.data?.audit?.alerts_configured ? " Operational alerts are configured." : ""}
            </p>
          </div>
          <div>
            <span>AI Safety Boundary</span>
            <p>Natural-language questions select safe materialized views; the LLM only augments explanations when configured.</p>
          </div>
        </div>
      </section>
    </>
  );
}
