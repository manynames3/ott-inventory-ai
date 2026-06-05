"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

import { completeCognitoLoginFromUrl, IS_COGNITO_AUTH, IS_DEMO_MODE, login, startCognitoLogin } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cognitoCallbackLoading, setCognitoCallbackLoading] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("next") || "/";
  }, []);

  useEffect(() => {
    if (!IS_COGNITO_AUTH) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code")) return;
    setCognitoCallbackLoading(true);
    completeCognitoLoginFromUrl()
      .then((next) => {
        window.location.href = next || "/";
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Cognito login failed");
      })
      .finally(() => setCognitoCallbackLoading(false));
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

  async function signInWithCognito() {
    setError(null);
    setLoading(true);
    try {
      await startCognitoLogin(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cognito login is not configured");
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Login</h1>
          <p>Sign in to StockSense AI.</p>
        </div>
      </header>

      <section className="panel auth-panel">
        {IS_DEMO_MODE ? (
          <div className="message ok">Demo mode is active.</div>
        ) : null}
        {IS_COGNITO_AUTH ? (
          <div className="form-grid">
            <div className="message info">
              Cognito SSO mode is active. Access is controlled by Cognito users and planner/approver/admin groups.
            </div>
            {error ? <div className="message error">{error}</div> : null}
            <button className="button" type="button" onClick={signInWithCognito} disabled={loading || cognitoCallbackLoading}>
              {loading || cognitoCallbackLoading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
              {cognitoCallbackLoading ? "Completing sign in" : "Sign in with Cognito"}
            </button>
          </div>
        ) : (
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
        )}
      </section>

    </>
  );
}
