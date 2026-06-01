"use client";

import { FormEvent, useMemo, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

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
    </>
  );
}
