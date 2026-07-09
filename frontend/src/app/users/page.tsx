"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, ShieldCheck, UserPlus, Users, X } from "lucide-react";

import { ConfirmDialog, PageLoading } from "@/components/feedback";
import {
  AdminUser,
  AdminUserResponse,
  AdminUsersResponse,
  AuthMeResponse,
  apiGet,
  apiPost
} from "@/lib/api";

const roles: AdminUser["role"][] = ["viewer", "planner", "approver", "admin"];

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function userLabel(user: AdminUser) {
  return user.email || user.username;
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<AuthMeResponse["user"] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("planner");
  const [sendInvite, setSendInvite] = useState(true);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "disable" | "reset"; user: AdminUser } | null>(null);

  const isAdmin = currentUser?.role === "admin";
  const activeCount = useMemo(() => users.filter((user) => user.enabled).length, [users]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!temporaryPassword) return;
    const timeout = window.setTimeout(() => {
      setTemporaryPassword(null);
      setShowTemporaryPassword(false);
      setPasswordCopied(false);
    }, 5 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [temporaryPassword]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const auth = await apiGet<AuthMeResponse>("/api/auth/me");
      setCurrentUser(auth.user);
      if (auth.user.role === "admin") {
        const body = await apiGet<AdminUsersResponse>("/api/admin/users");
        setUsers(body.rows);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    setTemporaryPassword(null);
    try {
      const body = await apiPost<AdminUserResponse>("/api/admin/users", {
        email,
        role,
        send_invite: sendInvite
      });
      setUsers((current) => [body.row, ...current.filter((user) => user.username !== body.row.username)]);
      setEmail("");
      setRole("planner");
      setSendInvite(true);
      setTemporaryPassword(body.temporary_password || null);
      setShowTemporaryPassword(false);
      setPasswordCopied(false);
      setMessage(body.invite_sent ? `Invitation sent to ${body.row.email}.` : `Created ${body.row.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(user: AdminUser, nextRole: AdminUser["role"]) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body = await apiPost<AdminUserResponse>(`/api/admin/users/${encodeURIComponent(user.username)}/role`, {
        role: nextRole
      });
      setUsers((current) => current.map((row) => (row.username === user.username ? body.row : row)));
      setMessage(`${userLabel(body.row)} is now ${body.row.role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role.");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(user: AdminUser, enabled: boolean) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const action = enabled ? "enable" : "disable";
      const body = await apiPost<AdminUserResponse>(`/api/admin/users/${encodeURIComponent(user.username)}/${action}`, {});
      setUsers((current) => current.map((row) => (row.username === user.username ? body.row : row)));
      setMessage(`${userLabel(body.row)} ${enabled ? "enabled" : "disabled"}.`);
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user: AdminUser) {
    setSaving(true);
    setError(null);
    setMessage(null);
    setTemporaryPassword(null);
    try {
      const body = await apiPost<AdminUserResponse>(
        `/api/admin/users/${encodeURIComponent(user.username)}/reset-password`,
        {}
      );
      setUsers((current) => current.map((row) => (row.username === user.username ? body.row : row)));
      setMessage(`Password reset email sent to ${userLabel(body.row)}.`);
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setSaving(false);
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setPasswordCopied(true);
    } catch {
      setError("The temporary password could not be copied. Reveal it and copy it manually.");
    }
  }

  if (loading) return <PageLoading label="Loading workspace users" />;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Invite workspace users, assign roles, reset passwords, and disable access from the app.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={load} disabled={loading || saving}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="message error" role="alert">{error}</div> : null}
      {message ? <div className="message ok" role="status">{message}</div> : null}
      {temporaryPassword ? (
        <div className="temporary-password-notice" role="status">
          <div>
            <strong>Temporary password created</strong>
            <span>It will be removed from this screen in five minutes. Share it only through an approved secure channel.</span>
          </div>
          <code>{showTemporaryPassword ? temporaryPassword : "••••••••••••"}</code>
          <div className="temporary-password-actions">
            <button className="button secondary compact-button" type="button" onClick={() => setShowTemporaryPassword((current) => !current)}>
              {showTemporaryPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              {showTemporaryPassword ? "Hide" : "Reveal"}
            </button>
            <button className="button secondary compact-button" type="button" onClick={() => void copyTemporaryPassword()}>
              <Copy size={15} />
              {passwordCopied ? "Copied" : "Copy"}
            </button>
            <button
              className="icon-button subtle-icon-button"
              type="button"
              aria-label="Remove temporary password from screen"
              onClick={() => setTemporaryPassword(null)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {!isAdmin ? (
        <section className="panel">
          <div className="empty-state">Admin role is required to manage workspace users.</div>
        </section>
      ) : null}

      {isAdmin ? (
        <>
          <section className="grid-3 buyer-value-grid">
            <div className="insight-card compact">
              <span className="insight-icon planner">
                <Users size={18} />
              </span>
              <h2>{users.length.toLocaleString()} Users</h2>
              <p>{activeCount.toLocaleString()} active accounts in this workspace.</p>
            </div>
            <div className="insight-card compact">
              <span className="insight-icon stockout">
                <ShieldCheck size={18} />
              </span>
              <h2>Roles</h2>
              <p>Viewer, planner, approver, and admin access maps to workspace permissions.</p>
            </div>
            <div className="insight-card compact">
              <span className="insight-icon waste">
                <UserPlus size={18} />
              </span>
              <h2>Invites</h2>
              <p>The sign-in service sends invitation and password reset emails when delivery is enabled.</p>
            </div>
          </section>

          <section className="grid-2">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Invite User</h2>
                  <p>Create a workspace account and assign initial access.</p>
                </div>
              </div>
              <form className="form-grid" onSubmit={createUser}>
                <label htmlFor="new-user-email">Email</label>
                <input
                  id="new-user-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <label htmlFor="new-user-role">Role</label>
                <select
                  id="new-user-role"
                  className="input"
                  value={role}
                  onChange={(event) => setRole(event.target.value as AdminUser["role"])}
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={(event) => setSendInvite(event.target.checked)}
                  />
                  Send invitation email
                </label>
                <button className="button" type="submit" disabled={saving}>
                  <UserPlus size={17} />
                  Invite user
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Role Policy</h2>
                  <p>Use the lowest role that matches the internal workflow.</p>
                </div>
              </div>
              <div className="security-list">
                <div>
                  <ShieldCheck size={18} />
                  <p>Viewer: read-only dashboard, reports, status, and query access.</p>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <p>Planner: add notes and dismiss/reopen recommendations.</p>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <p>Approver: approve planner actions and clear review history.</p>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <p>Admin: manage users and all approval controls.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Workspace Users</h2>
                <p>{loading ? "Loading workspace users." : `${users.length.toLocaleString()} accounts loaded.`}</p>
              </div>
            </div>
            {!users.length ? (
              <div className="empty-state" role="status">No workspace users yet. Invite the first user to begin assigning access.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table admin-users-table">
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                      <th scope="col">Access</th>
                      <th scope="col">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isCurrentAccount = user.username === currentUser?.username || user.email === currentUser?.username;
                      return (
                      <tr key={user.username}>
                        <td>{userLabel(user)}</td>
                        <td>
                          <select
                            className="input compact-input"
                            value={user.role}
                            onChange={(event) => updateRole(user, event.target.value as AdminUser["role"])}
                            disabled={saving || isCurrentAccount}
                            aria-label={`Role for ${userLabel(user)}`}
                            title={isCurrentAccount ? "Use another admin account to change your own role." : undefined}
                          >
                            {roles.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{user.enabled ? user.status || "enabled" : "disabled"}</td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>
                          <button
                            className="button secondary compact-button"
                            type="button"
                            onClick={() => user.enabled ? setPendingAction({ type: "disable", user }) : void setEnabled(user, true)}
                            disabled={saving || isCurrentAccount}
                            title={isCurrentAccount ? "You cannot disable your own account." : undefined}
                          >
                            {user.enabled ? "Disable" : "Enable"}
                          </button>
                        </td>
                        <td>
                          <button
                            className="button secondary compact-button"
                            type="button"
                            onClick={() => setPendingAction({ type: "reset", user })}
                            disabled={saving || !user.enabled}
                          >
                            Reset
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <ConfirmDialog
            open={Boolean(pendingAction)}
            title={pendingAction?.type === "disable" ? "Disable this user?" : "Send a password reset?"}
            description={
              pendingAction?.type === "disable"
                ? `${pendingAction ? userLabel(pendingAction.user) : "This user"} will immediately lose workspace access until an admin enables the account again.`
                : `The sign-in service will send ${pendingAction ? userLabel(pendingAction.user) : "this user"} a password reset email.`
            }
            confirmLabel={pendingAction?.type === "disable" ? "Disable user" : "Send reset email"}
            destructive={pendingAction?.type === "disable"}
            busy={saving}
            onCancel={() => setPendingAction(null)}
            onConfirm={() => {
              if (!pendingAction) return;
              if (pendingAction.type === "disable") void setEnabled(pendingAction.user, false);
              else void resetPassword(pendingAction.user);
            }}
          />
        </>
      ) : null}
    </>
  );
}
