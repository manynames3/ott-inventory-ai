"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

import {
  completeCognitoLoginFromUrl,
  ENABLE_DEMO_LOGIN,
  getAuthToken,
  IS_COGNITO_AUTH,
  IS_DEMO_MODE,
  login,
  loginWithCognitoPassword,
  startCognitoLogin
} from "@/lib/api";

const DEMO_USERNAME = ENABLE_DEMO_LOGIN ? process.env.NEXT_PUBLIC_DEMO_LOGIN_USERNAME || "" : "";
const DEMO_PASSWORD = ENABLE_DEMO_LOGIN ? process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD || "" : "";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [cognitoCallbackLoading, setCognitoCallbackLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
  }, []);

  useEffect(() => {
    if (!IS_COGNITO_AUTH) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code") && getAuthToken() && !IS_DEMO_MODE) {
      window.location.replace(nextPath);
      return;
    }
    if (!params.get("code")) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (active) setCognitoCallbackLoading(true);
    }, 0);
    completeCognitoLoginFromUrl()
      .then((next) => {
        window.location.href = next || "/";
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Sign-in could not be completed.");
      })
      .finally(() => {
        window.clearTimeout(loadingTimer);
        if (active) setCognitoCallbackLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [nextPath]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = username.trim();
    const nextErrors: { username?: string; password?: string } = {};
    if (!normalizedUsername) {
      nextErrors.username = "Enter your work email.";
    } else if (IS_COGNITO_AUTH && !/^\S+@\S+\.\S+$/.test(normalizedUsername)) {
      nextErrors.username = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    setError(null);
    try {
      if (IS_COGNITO_AUTH) {
        await loginWithCognitoPassword(normalizedUsername, password);
      } else {
        await login(normalizedUsername, password);
      }
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithCognito() {
    setError(null);
    setCompanyLoading(true);
    try {
      await startCognitoLogin(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Secure sign-in is not configured.");
      setCompanyLoading(false);
    }
  }

  function resetDemoCredentials() {
    setUsername(DEMO_USERNAME);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setFieldErrors({});
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
            <p>Sign in to your StockSense workspace to review inventory risk, planner actions, and operational reports.</p>
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

        <form className="auth-card auth-form" onSubmit={submit} noValidate aria-busy={loading || companyLoading || cognitoCallbackLoading}>
          {IS_COGNITO_AUTH ? (
            <>
              <div className="auth-card-header">
                <p>{ENABLE_DEMO_LOGIN ? "Demo access" : "Workspace sign-in"}</p>
                <h2>{ENABLE_DEMO_LOGIN ? "Try the live workspace" : "Continue with your work email"}</h2>
                <span>
                  {ENABLE_DEMO_LOGIN
                    ? "Demo credentials are prefilled. Replace them with your own workspace login anytime."
                    : "Use the email and password assigned by your workspace admin."}
                </span>
              </div>
              <div className="form-grid auth-field-grid">
                <label htmlFor="username">Email</label>
                <input
                  id="username"
                  className="input"
                  type="email"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setFieldErrors((current) => ({ ...current, username: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? "username-error" : undefined}
                  required
                />
                {fieldErrors.username ? <span className="field-error" id="username-error">{fieldErrors.username}</span> : null}
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input
                    id="password"
                    className="input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFieldErrors((current) => ({ ...current, password: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {fieldErrors.password ? <span className="field-error" id="password-error">{fieldErrors.password}</span> : null}
              </div>
              {error ? <div className="message error" role="alert">{error}</div> : null}
              <button
                className="button auth-primary-button"
                type="submit"
                disabled={loading || companyLoading || cognitoCallbackLoading}
              >
                {loading || cognitoCallbackLoading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
                {loading || cognitoCallbackLoading ? "Signing in" : "Enter workspace"}
                {!loading && !cognitoCallbackLoading ? <ArrowRight className="auth-button-arrow" size={17} /> : null}
              </button>
              <div className={ENABLE_DEMO_LOGIN ? "auth-secondary-actions" : "auth-secondary-actions single"}>
                {ENABLE_DEMO_LOGIN ? (
                  <button
                    className="button secondary auth-secondary-button"
                    type="button"
                    onClick={resetDemoCredentials}
                    disabled={loading || companyLoading}
                  >
                    Use demo login
                  </button>
                ) : null}
                <button
                  className="button secondary auth-secondary-button"
                  type="button"
                  onClick={signInWithCognito}
                  disabled={loading || companyLoading || cognitoCallbackLoading}
                >
                  {companyLoading ? <LockKeyhole size={16} /> : null}
                  Company sign-in
                </button>
              </div>
              {ENABLE_DEMO_LOGIN ? (
                <p className="auth-fine-print">
                  The demo account has planner access. Admins and invited users can enter their own credentials.
                </p>
              ) : (
                <p className="auth-fine-print">
                  Access is tied to named users and workspace roles. Contact an admin if your role looks wrong.
                </p>
              )}
            </>
          ) : (
            <>
            <div className="auth-card-header">
              <p>Secure sign-in</p>
              <h2>Continue with your workspace account</h2>
            </div>
            <div className="form-grid auth-field-grid">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors((current) => ({ ...current, username: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? "username-error" : undefined}
                required
              />
              {fieldErrors.username ? <span className="field-error" id="username-error">{fieldErrors.username}</span> : null}
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {fieldErrors.password ? <span className="field-error" id="password-error">{fieldErrors.password}</span> : null}
            </div>
            {error ? <div className="message error" role="alert">{error}</div> : null}
            <button className="button auth-primary-button" type="submit" disabled={loading || IS_DEMO_MODE}>
              {loading ? <LockKeyhole size={17} /> : <LogIn size={17} />}
              Sign in
            </button>
            </>
          )}
        </form>
      </section>

    </>
  );
}
