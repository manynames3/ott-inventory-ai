"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, BrainCircuit, Database, FileText, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";

import { ImportRequirementsResponse, apiGet } from "@/lib/api";

export default function SecurityPage() {
  const [requirements, setRequirements] = useState<ImportRequirementsResponse | null>(null);

  useEffect(() => {
    apiGet<ImportRequirementsResponse>("/api/import/requirements")
      .then(setRequirements)
      .catch(() => setRequirements(null));
  }, []);

  const retention = requirements?.retention || {
    raw_upload_days: 365,
    audit_event_days: 180,
    import_status_days: 90,
    immutable_archive_days: 2555,
  };
  const siem = requirements?.siem || { mode: "s3_archive_or_customer_forwarder", configured: false };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Security And Data Handling</h1>
          <p>Plain-English controls and pilot boundaries for inventory, order, customer, and inbound shipment files.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/status">
            System status
          </Link>
          <Link className="button secondary" href="/audit">
            <ShieldCheck size={17} />
            Audit trail
          </Link>
          <Link className="button" href="/imports">
            <UploadCloud size={17} />
            Import files
          </Link>
        </div>
      </header>

      <section className="grid-3 buyer-value-grid">
        <div className="insight-card compact">
          <span className="insight-icon planner">
            <LockKeyhole size={18} />
          </span>
          <h2>No Hardcoded Secrets</h2>
          <p>Local settings use environment variables. Hosted credentials are designed for SSM Parameter Store.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon waste">
            <Database size={18} />
          </span>
          <h2>Private Upload Flow</h2>
          <p>Hosted imports use private S3 object storage and DynamoDB-backed operational views.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon stockout">
            <ShieldCheck size={18} />
          </span>
          <h2>Approval, Not Writeback</h2>
          <p>Approver/admin roles can approve recommendations, but the MVP does not change ERP or WMS records.</p>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>What Is Stored</h2>
              <p>
                Only the data needed to produce inventory, FEFO (First Expired, First Out), reorder, customer, and query
                insights.
              </p>
            </div>
          </div>
          <div className="security-list">
            <div>
              <UploadCloud size={18} />
              <p>Raw CSV/XLSX uploads for products, inventory lots, customers, orders, and inbound shipments.</p>
            </div>
            <div>
              <Database size={18} />
              <p>Structured records and refreshed views used by the dashboard, action queue, and query page.</p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>Planner review decisions, notes, approver attribution, and reviewed action status.</p>
            </div>
            <div>
              <FileText size={18} />
              <p>Audit and monitoring events for login, imports, approvals, exports, API errors, slow jobs, and AI fallback.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>AI Boundary</h2>
              <p>StockSense AI is not an unrestricted database chatbot.</p>
            </div>
          </div>
          <div className="security-list">
            <div>
              <BrainCircuit size={18} />
              <p>Natural-language questions are routed to safe, known operational views.</p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>The LLM can summarize and prioritize bounded query results when configured.</p>
            </div>
            <div>
              <LockKeyhole size={18} />
              <p>When no AI key is configured, the product falls back to deterministic rule-based answers.</p>
            </div>
            <div>
              <FileText size={18} />
              <p>Query activity is audited with question previews and result counts for pilot review.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Retention Policy</h2>
              <p>Default pilot retention windows. Final values should be confirmed in the buyer security review.</p>
            </div>
          </div>
          <div className="security-list">
            <div>
              <Database size={18} />
              <p>Raw upload files: {retention.raw_upload_days.toLocaleString()} days in private S3 lifecycle storage.</p>
            </div>
            <div>
              <Activity size={18} />
              <p>App audit events: {retention.audit_event_days.toLocaleString()} days in the operational audit table.</p>
            </div>
            <div>
              <UploadCloud size={18} />
              <p>Import status and validation history: {retention.import_status_days.toLocaleString()} days for pilot operations.</p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>Immutable audit archive: {retention.immutable_archive_days.toLocaleString()} days when Object Lock is enabled.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>SIEM And Edge Security</h2>
              <p>Controls designed for a low-traffic pilot before a production security program.</p>
            </div>
          </div>
          <div className="security-list">
            <div>
              <FileText size={18} />
              <p>
                SIEM mode: {siem.mode.replaceAll("_", " ")}. Direct forwarding is{" "}
                {siem.configured ? "configured" : "left customer-specific until a reviewed endpoint and secret are provided"}.
              </p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <p>Optional AWS WAF protects the Cognito Hosted UI/auth path with rate limiting and AWS managed common rules.</p>
            </div>
            <div>
              <LockKeyhole size={18} />
              <p>Cloudflare Pages security headers are configured for clickjacking, MIME sniffing, referrer, permissions, and CSP review.</p>
            </div>
            <div>
              <Database size={18} />
              <p>Native AWS Transfer Family SFTP is available, but S3 landing plus scheduled scans remains the low-idle default.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pilot Boundaries Before Production Rollout</h2>
            <p>
              This MVP is suitable for a low-traffic buyer pilot with named users, role-based approvals, private file
              storage, audit visibility, and no ERP writeback. A production enterprise rollout should finalize SSO,
              tenant provisioning, buyer-specific retention/DPA terms, WAF/custom-domain review, SIEM forwarding, and a
              reviewed security questionnaire.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
