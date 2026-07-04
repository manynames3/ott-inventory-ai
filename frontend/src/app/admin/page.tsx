"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, KeyRound, Save, ShieldCheck } from "lucide-react";

import { AdminTenantConfig, AdminTenantResponse, AuthMeResponse, apiGet, apiPost } from "@/lib/api";

const lifecycleStages: AdminTenantConfig["lifecycle_stage"][] = ["setup", "pilot", "active", "paused", "churned"];
const billingStatuses: AdminTenantConfig["billing_status"][] = [
  "not_started",
  "trial",
  "invoice_pending",
  "active",
  "past_due",
  "canceled"
];
const billingPlans: AdminTenantConfig["billing_plan"][] = ["pilot", "growth", "enterprise", "custom"];
const ssoStatuses: AdminTenantConfig["sso_status"][] = [
  "cognito",
  "saml_ready",
  "saml_configured",
  "oidc_ready",
  "not_configured"
];

function label(value: string) {
  return value.replaceAll("_", " ");
}

function updatedAt(config: AdminTenantConfig | null) {
  if (!config?.updated_at_epoch) return "Not updated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(config.updated_at_epoch * 1000));
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<AuthMeResponse["user"] | null>(null);
  const [config, setConfig] = useState<AdminTenantConfig | null>(null);
  const [draft, setDraft] = useState<AdminTenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = currentUser?.role === "admin";
  const changed = useMemo(() => JSON.stringify(config) !== JSON.stringify(draft), [config, draft]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const auth = await apiGet<AuthMeResponse>("/api/auth/me");
      setCurrentUser(auth.user);
      if (auth.user.role === "admin") {
        const body = await apiGet<AdminTenantResponse>("/api/admin/tenant");
        setConfig(body.row);
        setDraft(body.row);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tenant administration.");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof AdminTenantConfig>(key: K, value: AdminTenantConfig[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body = await apiPost<AdminTenantResponse>("/api/admin/tenant", draft);
      setConfig(body.row);
      setDraft(body.row);
      setMessage("Account settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save account settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Admin</h1>
          <p>Manage tenant setup, customer lifecycle, billing posture, and enterprise SSO readiness.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={load} disabled={loading || saving}>
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="message error">{error}</div> : null}
      {message ? <div className="message ok">{message}</div> : null}

      {!loading && !isAdmin ? (
        <section className="panel">
          <div className="empty-state">Admin role is required to manage account settings.</div>
        </section>
      ) : null}

      {isAdmin && draft ? (
        <>
          <section className="grid-3 buyer-value-grid">
            <div className="insight-card compact">
              <span className="insight-icon planner">
                <Building2 size={18} />
              </span>
              <h2>{label(draft.lifecycle_stage)}</h2>
              <p>{draft.organization_name}</p>
            </div>
            <div className="insight-card compact">
              <span className="insight-icon stockout">
                <CreditCard size={18} />
              </span>
              <h2>{label(draft.billing_status)}</h2>
              <p>{label(draft.billing_plan)} plan via {label(draft.billing_provider)}.</p>
            </div>
            <div className="insight-card compact">
              <span className="insight-icon waste">
                <KeyRound size={18} />
              </span>
              <h2>{label(draft.sso_status)}</h2>
              <p>{draft.sso_provider}</p>
            </div>
          </section>

          <form className="grid-2" onSubmit={save}>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Tenant Profile</h2>
                  <p>Customer lifecycle and primary account identity.</p>
                </div>
              </div>
              <div className="form-grid">
                <label htmlFor="organization-name">Organization</label>
                <input
                  id="organization-name"
                  className="input"
                  value={draft.organization_name}
                  onChange={(event) => update("organization_name", event.target.value)}
                />
                <label htmlFor="tenant-id">Tenant ID</label>
                <input id="tenant-id" className="input" value={draft.tenant_id} readOnly />
                <label htmlFor="lifecycle-stage">Lifecycle stage</label>
                <select
                  id="lifecycle-stage"
                  className="input"
                  value={draft.lifecycle_stage}
                  onChange={(event) => update("lifecycle_stage", event.target.value as AdminTenantConfig["lifecycle_stage"])}
                >
                  {lifecycleStages.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Billing</h2>
                  <p>Subscription posture for pilot, invoice, and renewal tracking.</p>
                </div>
              </div>
              <div className="form-grid">
                <label htmlFor="billing-status">Billing status</label>
                <select
                  id="billing-status"
                  className="input"
                  value={draft.billing_status}
                  onChange={(event) => update("billing_status", event.target.value as AdminTenantConfig["billing_status"])}
                >
                  {billingStatuses.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
                <label htmlFor="billing-plan">Plan</label>
                <select
                  id="billing-plan"
                  className="input"
                  value={draft.billing_plan}
                  onChange={(event) => update("billing_plan", event.target.value as AdminTenantConfig["billing_plan"])}
                >
                  {billingPlans.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
                <label htmlFor="billing-contact">Billing contact</label>
                <input
                  id="billing-contact"
                  className="input"
                  type="email"
                  value={draft.billing_contact_email}
                  onChange={(event) => update("billing_contact_email", event.target.value)}
                />
                <label htmlFor="billing-provider">Billing provider</label>
                <input
                  id="billing-provider"
                  className="input"
                  value={draft.billing_provider}
                  onChange={(event) => update("billing_provider", event.target.value)}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Enterprise SSO</h2>
                  <p>Cognito Hosted UI is active; SAML/OIDC status is tracked here.</p>
                </div>
              </div>
              <div className="form-grid">
                <label htmlFor="auth-mode">Auth mode</label>
                <input id="auth-mode" className="input" value={draft.auth_mode} readOnly />
                <label htmlFor="sso-status">SSO status</label>
                <select
                  id="sso-status"
                  className="input"
                  value={draft.sso_status}
                  onChange={(event) => update("sso_status", event.target.value as AdminTenantConfig["sso_status"])}
                >
                  {ssoStatuses.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
                <label htmlFor="sso-provider">Provider</label>
                <input
                  id="sso-provider"
                  className="input"
                  value={draft.sso_provider}
                  onChange={(event) => update("sso_provider", event.target.value)}
                />
                <label htmlFor="sso-notes">Notes</label>
                <textarea
                  id="sso-notes"
                  className="textarea"
                  value={draft.sso_notes}
                  onChange={(event) => update("sso_notes", event.target.value)}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Controls</h2>
                  <p>Last saved: {updatedAt(config)}</p>
                </div>
              </div>
              <div className="security-list">
                <div>
                  <ShieldCheck size={18} />
                  <p>User access is managed from Cognito groups through the Users page.</p>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <p>Billing state is operational metadata; payment processing is configured per customer contract.</p>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <p>Enterprise SSO can be connected through Cognito SAML/OIDC provider configuration.</p>
                </div>
              </div>
              <div className="toolbar form-actions">
                <button className="button" type="submit" disabled={saving || !changed}>
                  <Save size={17} />
                  Save account settings
                </button>
              </div>
            </section>
          </form>
        </>
      ) : null}
    </>
  );
}
