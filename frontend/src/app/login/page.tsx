"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

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
        setError(err instanceof Error ? err.message : "Sign-in could not be completed.");
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
      setError(err instanceof Error ? err.message : "Secure sign-in is not configured.");
      setLoading(false);
    }
  }

  return (
    <>
      <section className="auth-hero" aria-labelledby="login-heading">
        {IS_DEMO_MODE ? (
          <div className="message ok">Demo mode is active.</div>
        ) : null}
        <div className="auth-copy">
          <img className="auth-logo" src="/assets/stocksense-ottogi-logo.svg" alt="" aria-hidden="true" />
          <div>
            <h1 id="login-heading">Welcome back</h1>
            <p>Sign in to your StockSense workspace to review inventory risk, planner actions, and pilot reports.</p>
          </div>
          <div className="auth-assurance">
            <span>
              <ShieldCheck size={17} />
              Workspace-managed access
            </span>
            <span>
              <CheckCircle2 size={17} />
              Role-based approvals
            </span>
          </div>
        </div>

        {IS_COGNITO_AUTH ? (
          <div className="auth-card">
            <div className="auth-card-header">
              <p>Secure sign-in</p>
              <h2>Continue with your work email</h2>
              <span>Your workspace admin manages access and roles.</span>
            </div>
            {error ? <div className="message error">{error}</div> : null}
            <button
              className="button auth-primary-button"
              type="button"
              onClick={signInWithCognito}
              disabled={loading || cognitoCallbackLoading}
            >
              {loading || cognitoCallbackLoading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
              {cognitoCallbackLoading ? "Completing sign in" : "Continue securely"}
              {!loading && !cognitoCallbackLoading ? <ArrowRight className="auth-button-arrow" size={17} /> : null}
            </button>
            <p className="auth-fine-print">Use the email and password provided for your StockSense workspace.</p>
          </div>
        ) : (
          <form className="auth-card auth-form" onSubmit={submit}>
            <div className="auth-card-header">
              <p>Secure sign-in</p>
              <h2>Continue with your workspace account</h2>
            </div>
            <div className="form-grid">
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
            </div>
            {error ? <div className="message error">{error}</div> : null}
            <button className="button auth-primary-button" type="submit" disabled={loading || IS_DEMO_MODE}>
              {loading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
              Sign in
            </button>
          </form>
        )}
      </section>

    </>
  );
}
