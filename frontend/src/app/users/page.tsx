"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";

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

  const isAdmin = currentUser?.role === "admin";
  const activeCount = useMemo(() => users.filter((user) => user.enabled).length, [users]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Invite pilot users, assign roles, and disable access from the app.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={load} disabled={loading || saving}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="message error">{error}</div> : null}
      {message ? <div className="message ok">{message}</div> : null}
      {temporaryPassword ? (
        <div className="message warning">
          Temporary password: <strong>{temporaryPassword}</strong>
        </div>
      ) : null}

      {!loading && !isAdmin ? (
        <section className="panel">
          <div className="empty-state">Admin role is required to manage pilot users.</div>
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
              <p>{activeCount.toLocaleString()} active accounts in this pilot workspace.</p>
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
              <p>The sign-in service sends a temporary-password email when invitation delivery is enabled.</p>
            </div>
          </section>

          <section className="grid-2">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Invite User</h2>
                  <p>Create a workspace account and assign initial pilot access.</p>
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
                  <p>Use the lowest role that matches the buyer workflow.</p>
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
                <h2>Pilot Users</h2>
                <p>{loading ? "Loading workspace users." : `${users.length.toLocaleString()} accounts loaded.`}</p>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading users</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table admin-users-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.username}>
                        <td>{userLabel(user)}</td>
                        <td>
                          <select
                            className="input compact-input"
                            value={user.role}
                            onChange={(event) => updateRole(user, event.target.value as AdminUser["role"])}
                            disabled={saving}
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
                            onClick={() => setEnabled(user, !user.enabled)}
                            disabled={saving}
                          >
                            {user.enabled ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
