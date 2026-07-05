"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileDown, LayoutDashboard, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import {
  ActionReviewsResponse,
  ActionReviewUpsertResponse,
  AuthMeResponse,
  DashboardResponse,
  IS_DEMO_MODE,
  apiGet,
  apiPost,
  formatCurrency
} from "@/lib/api";
import { buildPriorityActions } from "@/lib/priority-actions";

const ACTION_REVIEW_KEY = "stocksense_action_review_v1";

type ReviewStatus = "open" | "accepted" | "dismissed";

type ActionReviewState = {
  status: ReviewStatus;
  note?: string;
  updated_by?: string;
  approved_by?: string;
  approved_at?: string;
  updated_at?: string;
};

function actionKey(row: Record<string, unknown>): string {
  return [
    row.priority,
    row.action_type,
    row.sku,
    row.warehouse,
    row.lot_id || "sku",
    row.due_date
  ]
    .map((value) => String(value || ""))
    .join("::");
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return String(value);
}

function csvValue(value: unknown): string {
  const output = text(value).replaceAll('"', '""');
  return /[",\n]/.test(output) ? `"${output}"` : output;
}

function formatTimestamp(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export default function ActionsPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<Record<string, ActionReviewState>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [reviewStorage, setReviewStorage] = useState<"server" | "browser">(IS_DEMO_MODE ? "browser" : "server");
  const [reviewSyncMessage, setReviewSyncMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthMeResponse["user"] | null>(null);

  useEffect(() => {
    apiGet<DashboardResponse>("/api/dashboard")
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load priority actions."));
  }, []);

  useEffect(() => {
    apiGet<AuthMeResponse>("/api/auth/me")
      .then((body) => setCurrentUser(body.user))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setReviewStorage("browser");
      loadBrowserReviewState();
      return;
    }
    apiGet<ActionReviewsResponse>("/api/action-reviews")
      .then((body) => {
        const serverState: Record<string, ActionReviewState> = {};
        const serverNotes: Record<string, string> = {};
        for (const row of body.rows) {
          serverState[row.action_key] = {
            status: row.status,
            note: row.note || "",
            updated_by: row.updated_by || "",
            approved_by: row.approved_by || "",
            approved_at: row.approved_at || (row.approved_at_epoch ? new Date(row.approved_at_epoch * 1000).toISOString() : undefined),
            updated_at: row.updated_at || (row.updated_at_epoch ? new Date(row.updated_at_epoch * 1000).toISOString() : undefined)
          };
          if (row.note) {
            serverNotes[row.action_key] = row.note;
          }
        }
        setReviewState((current) => ({ ...current, ...serverState }));
        setNoteDrafts((current) => ({ ...current, ...serverNotes }));
        setReviewStorage(body.storage === "server" ? "server" : "browser");
        setReviewSyncMessage(null);
      })
      .catch(() => {
        setReviewStorage("browser");
        loadBrowserReviewState();
        setReviewSyncMessage("Server review history is unavailable. Changes are saved in this browser until sync is restored.");
      });
  }, []);

  const actions = useMemo(() => (dashboard ? buildPriorityActions(dashboard) : []), [dashboard]);
  const p1Count = actions.filter((row) => row.priority === "P1").length;
  const visibleActions = actions.slice(0, 18);
  const reorderValue = dashboard?.kpis.recommended_reorder_value || 0;
  const wasteValue = dashboard?.kpis.waste_reduction_opportunity || 0;
  const reviewCounts = useMemo(() => {
    const counts: Record<ReviewStatus, number> = { open: 0, accepted: 0, dismissed: 0 };
    for (const row of actions) {
      const status = reviewState[actionKey(row)]?.status;
      if (status === "accepted") {
        counts.accepted += 1;
      } else if (status === "dismissed") {
        counts.dismissed += 1;
      } else {
        counts.open += 1;
      }
    }
    return counts;
  }, [actions, reviewState]);
  const reviewStateCount = Object.keys(reviewState).length;
  const canApproveActions = Boolean(currentUser?.can_approve_actions || IS_DEMO_MODE);
  const userRole = currentUser?.role || (IS_DEMO_MODE ? "approver" : "planner");
  const username = currentUser?.username || (IS_DEMO_MODE ? "demo-planner" : "unknown");

  function loadBrowserReviewState() {
    try {
      const raw = window.localStorage.getItem(ACTION_REVIEW_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ActionReviewState>;
      setReviewState(parsed);
      setNoteDrafts(
        Object.fromEntries(
          Object.entries(parsed)
            .filter(([, value]) => value.note)
            .map(([key, value]) => [key, value.note || ""])
        )
      );
    } catch {
      setReviewState({});
    }
  }

  function persistReview(next: Record<string, ActionReviewState>) {
    setReviewState(next);
    window.localStorage.setItem(ACTION_REVIEW_KEY, JSON.stringify(next));
  }

  function syncReview(key: string, status: ReviewStatus, note: string, row: Record<string, unknown>) {
    if (IS_DEMO_MODE) return;
    apiPost<ActionReviewUpsertResponse>("/api/action-reviews", {
      action_key: key,
      status,
      note,
      action_snapshot: row
    })
      .then((body) => {
        setReviewStorage(body.storage === "server" ? "server" : "browser");
        setReviewSyncMessage(null);
      })
      .catch((err) => {
        setReviewStorage("browser");
        setReviewSyncMessage(
          err instanceof Error
            ? `${err.message} The local review state remains saved in this browser.`
            : "Could not sync this review to the server. It remains saved in this browser."
        );
      });
  }

  function setActionStatus(key: string, status: ReviewStatus, row: Record<string, unknown>) {
    if (status === "accepted" && !canApproveActions) {
      setReviewSyncMessage("Your role can add notes or dismiss actions, but approver/admin access is required to approve.");
      return;
    }
    const note = noteDrafts[key] ?? reviewState[key]?.note ?? "";
    persistReview({
      ...reviewState,
      [key]: {
        ...reviewState[key],
        status,
        note,
        updated_by: username,
        approved_by: status === "accepted" ? username : status === "open" ? "" : reviewState[key]?.approved_by,
        approved_at: status === "accepted" ? new Date().toISOString() : status === "open" ? "" : reviewState[key]?.approved_at,
        updated_at: new Date().toISOString()
      }
    });
    syncReview(key, status, note, row);
  }

  function saveNote(key: string, note: string, row: Record<string, unknown>) {
    const status = reviewState[key]?.status || "open";
    persistReview({
      ...reviewState,
      [key]: {
        ...reviewState[key],
        status,
        note,
        updated_by: username,
        updated_at: new Date().toISOString()
      }
    });
    syncReview(key, status, note, row);
  }

  function downloadReviewedCsv() {
    const columns = [
      "review_status",
      "planner_note",
      "priority",
      "action_type",
      "sku",
      "product_name",
      "category",
      "warehouse",
      "lot_id",
      "due_date",
      "financial_impact",
      "recommended_action",
      "reason",
      "confidence",
      "confidence_reason",
      "updated_by",
      "updated_at",
      "approved_by",
      "approved_at"
    ];
    const rows: Record<string, unknown>[] = actions.map((row) => {
      const state = reviewState[actionKey(row)] || { status: "open" };
      return {
        ...row,
        review_status: state.status === "accepted" ? "approved" : state.status,
        planner_note: state.note || "",
        updated_by: state.updated_by || "",
        updated_at: state.updated_at || "",
        approved_by: state.approved_by || "",
        approved_at: state.approved_at || ""
      };
    });
    const csv = [
      columns.join(","),
      ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))
    ].join("\n");
    const blob = new Blob([`${csv}\n`], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stocksense_reviewed_actions.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function clearReviewState() {
    if (!canApproveActions) {
      setReviewSyncMessage("Approver/admin access is required to clear planner review history.");
      return;
    }
    setReviewState({});
    setNoteDrafts({});
    window.localStorage.removeItem(ACTION_REVIEW_KEY);
    if (!IS_DEMO_MODE) {
      apiPost<{ deleted: number; storage?: "server" | "browser" }>("/api/action-reviews/clear", {})
        .then((body) => {
          setReviewStorage(body.storage === "server" ? "server" : "browser");
          setReviewSyncMessage(null);
        })
        .catch(() => {
          setReviewStorage("browser");
          setReviewSyncMessage("Could not clear server review history. Local review state was cleared in this browser.");
        });
    }
  }

  if (error) {
    return (
      <section className="panel">
        <div className="message error">{error}</div>
        <div className="toolbar error-toolbar">
          <Link className="button secondary" href="/status">
            System status
          </Link>
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="panel">
        <div className="empty-state">Loading priority queue</div>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Today&apos;s Priority Actions</h1>
          <p>
            Ranked planner queue for fill-rate protection, waste prevention, and FEFO (First Expired, First Out)
            execution.
          </p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          <Link className="button" href="/query">
            Ask StockSense AI
          </Link>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="P1 actions" value={p1Count.toLocaleString()} tone="stockout" />
        <MetricCard label="Open review items" value={reviewCounts.open.toLocaleString()} tone="risk" />
        <MetricCard label="Approved in planner review" value={reviewCounts.accepted.toLocaleString()} tone="value" />
        <MetricCard label="Reorder dollars in queue" value={formatCurrency(reorderValue)} tone="reorder" />
        <MetricCard label="Recoverable before expiry" value={formatCurrency(wasteValue)} tone="waste" />
      </section>

      <section className="grid-3 buyer-value-grid">
        <div className="insight-card compact">
          <span className="insight-icon stockout">
            <AlertTriangle size={18} />
          </span>
          <h2>Protect Fill Rate</h2>
          <p>Act first on stockout-risk rows where lead-time demand exceeds usable inventory.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon waste">
            <Clock3 size={18} />
          </span>
          <h2>Prevent Waste</h2>
          <p>Move near-expiring lots by allocation, transfer, promotion, or discount before newer lots ship.</p>
        </div>
        <div className="insight-card compact">
          <span className="insight-icon planner">
            <CheckCircle2 size={18} />
          </span>
          <h2>Defend The Decision</h2>
          <p>Each action includes the operational reason and confidence note a planner can challenge.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Planner Review Queue</h2>
            <p>
              Review recommendations, capture planner notes, and export the queue for follow-up. These controls do not
              place orders or write back to ERP.
            </p>
          </div>
          <div className="toolbar">
            <button className="button secondary" type="button" onClick={clearReviewState} disabled={!reviewStateCount || !canApproveActions}>
              <RotateCcw size={17} />
              Clear review state
            </button>
            <button className="button secondary" type="button" onClick={downloadReviewedCsv} disabled={!actions.length}>
              <FileDown size={17} />
              Export reviewed CSV
            </button>
          </div>
        </div>
        <div className="message info">
          Planner review state is {reviewStorage === "server" ? "synced to the workspace backend" : "saved in this browser"}.
          {" "}Current role: {userRole}. Approval requires approver/admin access. The reviewed CSV is the handoff artifact.
        </div>
        {reviewSyncMessage ? <div className="message warning">{reviewSyncMessage}</div> : null}
        {actions.length > 18 ? (
          <p className="metrics-helper">
            Showing the top 18 actions by urgency. Exported CSV includes all {actions.length.toLocaleString()} actions.
          </p>
        ) : null}
        {actions.length ? (
          <div className="planner-review-list">
            {visibleActions.map((row) => {
              const key = actionKey(row);
              const state = reviewState[key] || { status: "open" as ReviewStatus };
              const note = noteDrafts[key] ?? state.note ?? "";
              return (
                <article className="planner-review-card" key={key}>
                  <div className="planner-review-heading">
                    <div>
                      <div className="planner-review-tags">
                        <StatusPill value={row.priority} />
                        <StatusPill value={state.status} />
                      </div>
                      <h3>
                        {text(row.action_type)}: {text(row.sku)}
                      </h3>
                      <p>{text(row.product_name)}{row.warehouse ? ` - ${text(row.warehouse)}` : ""}</p>
                    </div>
                    <strong>{text(row.financial_impact)}</strong>
                  </div>

                  <dl className="planner-review-meta">
                    <div>
                      <dt>Due date</dt>
                      <dd>{text(row.due_date)}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{text(row.category)}</dd>
                    </div>
                    <div>
                      <dt>Lot</dt>
                      <dd>{text(row.lot_id)}</dd>
                    </div>
                  </dl>

                  <div className="planner-review-copy">
                    <div>
                      <span>Action</span>
                      <p>{text(row.recommended_action)}</p>
                    </div>
                    <div>
                      <span>Reason</span>
                      <p>{text(row.reason)}</p>
                    </div>
                    <div>
                      <span>Confidence</span>
                      <p>{text(row.confidence_reason)}</p>
                    </div>
                  </div>

                  <div className="planner-review-status">
                    <span>Review evidence</span>
                    <p>
                      {state.updated_at
                        ? `Last updated by ${state.updated_by || "unknown"} on ${formatTimestamp(state.updated_at)}.`
                        : "Not reviewed yet."}
                      {state.approved_by
                        ? ` Approved by ${state.approved_by} on ${formatTimestamp(state.approved_at)}.`
                        : " Approval is required before this becomes an execution handoff."}
                    </p>
                  </div>

                  <label className="planner-note-label">
                    <span>Planner note</span>
                    <textarea
                      className="textarea"
                      value={note}
                      placeholder="Add buyer, transfer, promotion, or replenishment context."
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [key]: event.target.value
                        }))
                      }
                      onBlur={(event) => saveNote(key, event.currentTarget.value, row)}
                    />
                  </label>

                  <div className="toolbar planner-review-actions">
                    <button className="button" type="button" onClick={() => setActionStatus(key, "accepted", row)} disabled={!canApproveActions}>
                      Approve
                    </button>
                    <button className="button secondary" type="button" onClick={() => setActionStatus(key, "dismissed", row)}>
                      Dismiss
                    </button>
                    {state.status !== "open" ? (
                      <button className="button secondary" type="button" onClick={() => setActionStatus(key, "open", row)}>
                        Reopen
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No priority actions need planner review right now.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Ranked Action Queue</h2>
            <p>{actions.length.toLocaleString()} recommendations ranked by urgency and due date. The table remains available for audit and export checks.</p>
          </div>
        </div>
        <DataTable
          columns={[
            "priority",
            "action_type",
            "sku",
            "product_name",
            "category",
            "warehouse",
            "lot_id",
            "due_date",
            "financial_impact",
            "recommended_action",
            "reason",
            "confidence",
            "confidence_reason"
          ]}
          rows={actions}
        />
      </section>
    </>
  );
}
