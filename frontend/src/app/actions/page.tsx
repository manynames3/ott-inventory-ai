"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileDown, LayoutDashboard, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { ConfirmDialog, PageError, PageLoading } from "@/components/feedback";
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

function browserReviewState(): Record<string, ActionReviewState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACTION_REVIEW_KEY);
    return raw ? JSON.parse(raw) as Record<string, ActionReviewState> : {};
  } catch {
    return {};
  }
}

function notesFromReviews(reviews: Record<string, ActionReviewState>) {
  return Object.fromEntries(
    Object.entries(reviews)
      .filter(([, value]) => value.note)
      .map(([key, value]) => [key, value.note || ""])
  );
}

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
  const [reviewStorage, setReviewStorage] = useState<"server" | "browser" | "unavailable">(IS_DEMO_MODE ? "browser" : "server");
  const [reviewNotice, setReviewNotice] = useState<{ tone: "ok" | "warning"; text: string } | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(!IS_DEMO_MODE);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
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
      const timeout = window.setTimeout(() => {
        const storedReviews = browserReviewState();
        setReviewState(storedReviews);
        setNoteDrafts(notesFromReviews(storedReviews));
      }, 0);
      return () => window.clearTimeout(timeout);
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
        setReviewState(serverState);
        setNoteDrafts(serverNotes);
        setReviewStorage("server");
        setReviewNotice(null);
      })
      .catch(() => {
        setReviewStorage("unavailable");
        setReviewNotice({
          tone: "warning",
          text: "Planner review history is unavailable. Review controls are paused so decisions are not mistaken for saved workspace records."
        });
      })
      .finally(() => setReviewsLoading(false));
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
  const canEditReviews = !reviewsLoading && (IS_DEMO_MODE || reviewStorage === "server");
  const userRole = currentUser?.role || (IS_DEMO_MODE ? "approver" : "planner");
  const username = currentUser?.username || (IS_DEMO_MODE ? "demo-planner" : "unknown");

  function persistReview(next: Record<string, ActionReviewState>) {
    setReviewState(next);
    window.localStorage.setItem(ACTION_REVIEW_KEY, JSON.stringify(next));
  }

  function applyServerReview(key: string, body: ActionReviewUpsertResponse) {
    const row = body.row;
    const nextState: ActionReviewState = {
      status: row.status,
      note: row.note || "",
      updated_by: row.updated_by || "",
      approved_by: row.approved_by || "",
      approved_at: row.approved_at || (row.approved_at_epoch ? new Date(row.approved_at_epoch * 1000).toISOString() : undefined),
      updated_at: row.updated_at || (row.updated_at_epoch ? new Date(row.updated_at_epoch * 1000).toISOString() : undefined)
    };
    setReviewState((current) => ({ ...current, [key]: nextState }));
    setNoteDrafts((current) => ({ ...current, [key]: row.note || "" }));
    setReviewStorage("server");
  }

  async function setActionStatus(key: string, status: ReviewStatus, row: Record<string, unknown>) {
    if (!canEditReviews) {
      setReviewNotice({ tone: "warning", text: "Review controls are unavailable until the workspace review service reconnects." });
      return;
    }
    if (status === "accepted" && !canApproveActions) {
      setReviewNotice({ tone: "warning", text: "Your role can add notes or dismiss actions, but approver or admin access is required to approve." });
      return;
    }
    const note = noteDrafts[key] ?? reviewState[key]?.note ?? "";
    if (status === "dismissed" && note.trim().length < 3) {
      setReviewNotice({ tone: "warning", text: "Add a short planner note before dismissing an action so the decision remains auditable." });
      return;
    }
    setBusyActionKey(key);
    setReviewNotice(null);
    if (IS_DEMO_MODE) {
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
      setReviewNotice({ tone: "ok", text: `Demo review marked ${status === "accepted" ? "approved" : status}.` });
      setBusyActionKey(null);
      return;
    }
    try {
      const body = await apiPost<ActionReviewUpsertResponse>("/api/action-reviews", {
        action_key: key,
        status,
        note,
        action_snapshot: row
      });
      applyServerReview(key, body);
      setReviewNotice({ tone: "ok", text: `Action ${status === "accepted" ? "approved" : status}. The workspace review record is saved.` });
    } catch (err) {
      setReviewNotice({ tone: "warning", text: err instanceof Error ? err.message : "The review could not be saved." });
    } finally {
      setBusyActionKey(null);
    }
  }

  async function saveNote(key: string, note: string, row: Record<string, unknown>) {
    const status = reviewState[key]?.status || "open";
    if (note === (reviewState[key]?.note || "")) return;
    if (!canEditReviews) {
      setReviewNotice({ tone: "warning", text: "The note was not saved because the workspace review service is unavailable." });
      return;
    }
    setBusyActionKey(key);
    setReviewNotice(null);
    if (IS_DEMO_MODE) {
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
      setReviewNotice({ tone: "ok", text: "Demo planner note saved in this browser." });
      setBusyActionKey(null);
      return;
    }
    try {
      const body = await apiPost<ActionReviewUpsertResponse>("/api/action-reviews", {
        action_key: key,
        status,
        note,
        action_snapshot: row
      });
      applyServerReview(key, body);
      setReviewNotice({ tone: "ok", text: "Planner note saved to the workspace review record." });
    } catch (err) {
      setReviewNotice({ tone: "warning", text: err instanceof Error ? err.message : "The planner note could not be saved." });
    } finally {
      setBusyActionKey(null);
    }
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

  async function clearReviewState() {
    if (!canApproveActions) {
      setReviewNotice({ tone: "warning", text: "Approver or admin access is required to clear planner review history." });
      return;
    }
    setBusyActionKey("__clear__");
    setReviewNotice(null);
    try {
      if (!IS_DEMO_MODE) {
        await apiPost<{ deleted: number; storage?: "server" }>("/api/action-reviews/clear", {});
      }
      setReviewState({});
      setNoteDrafts({});
      window.localStorage.removeItem(ACTION_REVIEW_KEY);
      setReviewStorage(IS_DEMO_MODE ? "browser" : "server");
      setReviewNotice({ tone: "ok", text: "Planner review history cleared." });
      setClearDialogOpen(false);
    } catch (err) {
      setReviewNotice({ tone: "warning", text: err instanceof Error ? err.message : "Review history could not be cleared." });
    } finally {
      setBusyActionKey(null);
    }
  }

  if (error) {
    return (
      <PageError
        title="Priority actions are unavailable"
        message={error}
        action={
          <div className="toolbar error-toolbar">
          <Link className="button secondary" href="/status">
            System status
          </Link>
          <Link className="button" href="/login">
            Sign in
          </Link>
          </div>
        }
      />
    );
  }

  if (!dashboard) {
    return <PageLoading label="Loading priority actions" />;
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
            <button
              className="button secondary"
              type="button"
              onClick={() => setClearDialogOpen(true)}
              disabled={!reviewStateCount || !canApproveActions || !canEditReviews || Boolean(busyActionKey)}
            >
              <RotateCcw size={17} />
              Clear review state
            </button>
            <button className="button secondary" type="button" onClick={downloadReviewedCsv} disabled={!actions.length}>
              <FileDown size={17} />
              Export reviewed CSV
            </button>
          </div>
        </div>
        <div className="message info" role="status">
          {reviewsLoading
            ? "Loading workspace review history."
            : reviewStorage === "server"
              ? "Planner decisions are saved to the workspace review record."
              : reviewStorage === "browser"
                ? "Demo review state is saved only in this browser."
                : "Workspace review controls are temporarily paused."}
          {" "}Current role: {userRole}. Approval requires approver or admin access.
        </div>
        {reviewNotice ? <div className={`message ${reviewNotice.tone}`} role={reviewNotice.tone === "warning" ? "alert" : "status"}>{reviewNotice.text}</div> : null}
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
                      onBlur={(event) => void saveNote(key, event.currentTarget.value, row)}
                      maxLength={500}
                      disabled={!canEditReviews || busyActionKey === key}
                    />
                  </label>

                  <div className="toolbar planner-review-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => void setActionStatus(key, "accepted", row)}
                      disabled={!canApproveActions || !canEditReviews || busyActionKey === key}
                    >
                      Approve
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void setActionStatus(key, "dismissed", row)}
                      disabled={!canEditReviews || busyActionKey === key}
                    >
                      Dismiss
                    </button>
                    {state.status !== "open" ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => void setActionStatus(key, "open", row)}
                        disabled={!canEditReviews || busyActionKey === key}
                      >
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
      <ConfirmDialog
        open={clearDialogOpen}
        title="Clear planner review history?"
        description="This removes all saved review statuses and notes for the current workspace. The action cannot be undone."
        confirmLabel="Clear review history"
        destructive
        busy={busyActionKey === "__clear__"}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={() => void clearReviewState()}
      />
    </>
  );
}
