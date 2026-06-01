"use client";

import { FormEvent, useMemo, useState } from "react";
import { DatabaseZap, KeyRound, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

import { IS_DEMO_MODE, login } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("next") || "/";
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Login</h1>
          <p>Secure access for planners, operations, and supply chain leaders reviewing live data.</p>
        </div>
      </header>

      <section className="panel auth-panel">
        {IS_DEMO_MODE ? (
          <div className="message ok">
            Demo mode is active on the public frontend. Login is used when a hosted backend is connected.
          </div>
        ) : null}
        <form className="form-grid" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <div className="message error">{error}</div> : null}
          <button className="button" type="submit" disabled={loading || IS_DEMO_MODE}>
            {loading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
            Sign in
          </button>
        </form>
      </section>

      <section className="grid-3 login-security-grid">
        <div className="insight-card">
          <span className="insight-icon planner">
            <ShieldCheck size={18} />
          </span>
          <h2>Private Pilot Access</h2>
          <p>Access is limited to approved pilot users. The public frontend cannot read operational data without a token.</p>
        </div>
        <div className="insight-card">
          <span className="insight-icon stockout">
            <KeyRound size={18} />
          </span>
          <h2>Secret Storage</h2>
          <p>Credentials and token-signing keys are stored in AWS SSM Parameter Store, not hardcoded in the frontend.</p>
        </div>
        <div className="insight-card">
          <span className="insight-icon waste">
            <DatabaseZap size={18} />
          </span>
          <h2>No ERP Writeback</h2>
          <p>Uploaded files feed a read-only decision layer. The MVP does not post transactions back into SAP or Oracle.</p>
        </div>
      </section>
    </>
  );
}
