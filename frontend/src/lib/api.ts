import { getDemoGet, getDemoPost } from "@/lib/demo-data";

const HOSTED_API_BASE_URL = "https://3eorxcthij.execute-api.us-west-2.amazonaws.com";
const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || HOSTED_API_BASE_URL;

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || "cognito";
export const IS_COGNITO_AUTH = AUTH_MODE === "cognito";
export const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV || "demo").toLowerCase();
export const IS_INTERNAL_ENV = APP_ENV === "internal" || APP_ENV === "production";
export const ENABLE_DEMO_LOGIN =
  (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN || (IS_INTERNAL_ENV ? "false" : "true")) === "true";
export const SHOW_DEMO_BANNER =
  (process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER || (ENABLE_DEMO_LOGIN ? "true" : "false")) === "true";
export const WORKSPACE_NAME =
  process.env.NEXT_PUBLIC_WORKSPACE_NAME || (IS_INTERNAL_ENV ? "Internal operations workspace" : "Ottogi operations demo");

const COGNITO_DOMAIN = (
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "https://ott-inventory-ai-mvp-636305658578.auth.us-west-2.amazoncognito.com"
).replace(/\/+$/, "");
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "hfnqc87er9c4suqd4qgf0ppuq";
const COGNITO_REDIRECT_URI = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || "https://otokistocksense.pages.dev/login";
const COGNITO_LOGOUT_URI = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI || "https://otokistocksense.pages.dev/login";
const COGNITO_REGION =
  process.env.NEXT_PUBLIC_COGNITO_REGION || COGNITO_DOMAIN.match(/auth\.([a-z0-9-]+)\.amazoncognito\.com/)?.[1] || "us-west-2";

const TOKEN_KEY = "stocksense_access_token";
const COGNITO_CODE_VERIFIER_KEY = "stocksense_cognito_code_verifier";
const COGNITO_STATE_KEY = "stocksense_cognito_state";
const COGNITO_NEXT_KEY = "stocksense_cognito_next";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: { username: string; tenant_id?: string; role?: string; can_approve_actions?: boolean };
};

export type AuthMeResponse = {
  user: {
    username?: string;
    tenant_id?: string;
    role?: string;
    can_approve_actions?: boolean;
  };
};

export type AdminUser = {
  username: string;
  email: string;
  enabled: boolean;
  status: string;
  role: "viewer" | "planner" | "approver" | "admin";
  groups: string[];
  created_at?: string;
  last_modified_at?: string;
};

export type AdminUsersResponse = {
  rows: AdminUser[];
  count: number;
  user_pool_id: string;
};

export type AdminUserResponse = {
  row: AdminUser;
  invite_sent?: boolean;
  temporary_password?: string;
  reset_sent?: boolean;
};

export type AdminTenantConfig = {
  tenant_id: string;
  organization_name: string;
  lifecycle_stage: "setup" | "pilot" | "active" | "paused" | "churned";
  billing_status: "not_started" | "trial" | "invoice_pending" | "active" | "past_due" | "canceled";
  billing_plan: "pilot" | "growth" | "enterprise" | "custom";
  billing_contact_email: string;
  billing_provider: string;
  auth_mode: string;
  sso_status: "cognito" | "saml_ready" | "saml_configured" | "oidc_ready" | "not_configured";
  sso_provider: string;
  sso_notes: string;
  cognito_user_pool_id?: string;
  cognito_user_pool_client_id?: string;
  updated_at_epoch?: number;
  updated_by?: string;
};

export type AdminTenantResponse = {
  row: AdminTenantConfig;
};

export type HealthResponse = {
  ok: boolean;
  service: string;
  tenant_id?: string;
};

export type AiStatusResponse = {
  provider: string;
  model: string;
  enabled: boolean;
  configured: boolean;
  mode: string;
  secret_source?: string;
};

export type ImportRequirementsResponse = {
  csv_required_columns: Record<string, string[]>;
  erp_adapters: Record<string, string>;
  supported_upload_formats?: string[];
  template_formats?: string[];
  upload_mode?: "multipart" | "presigned_s3";
  import_workflow?: string;
  mapping_preview?: {
    enabled: boolean;
    preview_prefix: string;
    commit_endpoint: string;
  };
  raw_file_storage?: {
    service: string;
    enabled: boolean;
    bucket_configured: boolean;
    bucket?: string;
    prefix: string;
  };
  query_store?: {
    service: string;
    records_table?: string;
    views_table?: string;
  };
  scheduled_imports?: {
    enabled: boolean;
    prefixes?: string[];
    mode?: string;
  };
  auth?: {
    mode: string;
    cognito_ready?: boolean;
    cognito_user_pool_id?: string;
  };
  audit?: {
    immutable_archive_configured: boolean;
    alerts_configured: boolean;
  };
  retention?: {
    raw_upload_days: number;
    audit_event_days: number;
    import_status_days: number;
    immutable_archive_days: number;
  };
  siem?: {
    mode: string;
    configured: boolean;
  };
};

export type TableResponse = {
  rows: Record<string, unknown>[];
  count?: number;
};

export type Kpis = {
  total_inventory_value: number;
  inventory_at_risk_value: number;
  projected_stockouts: number;
  recommended_reorder_value: number;
  waste_reduction_opportunity: number;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type DashboardResponse = {
  kpis: Kpis;
  charts: {
    demand_trend_by_sku: { sku: string; points: ChartPoint[] }[];
    inventory_by_expiration_bucket: { bucket: string; quantity: number; value: number }[];
    reorder_urgency: { status: string; count: number }[];
  };
  recommendations: Record<string, unknown>[];
  fefo: Record<string, unknown>[];
  waste_risk_alerts: Record<string, unknown>[];
  roi_explanation?: string;
};

export type QueryResponse = {
  question: string;
  template: string;
  explanation: string;
  action_summary?: string[];
  ai?: {
    provider: string;
    model: string;
    enabled: boolean;
    configured: boolean;
    mode: string;
    secret_source?: string;
  };
  ai_status?: string;
  ai_risk_notes?: string[];
  ai_confidence_note?: string;
  sources?: {
    source_id: string;
    source_type: string;
    description: string;
    row_count: number;
    columns: string[];
    sample_record_ids?: string[];
  }[];
  columns: string[];
  rows: Record<string, unknown>[];
  safe_query_mode: string;
};

export type ImportChecklistItem = {
  entity: string;
  label: string;
  status: "complete" | "missing" | "needs_fix" | "processing";
  required_columns: string[];
  message: string;
  rows_imported: number;
  error_count: number;
  updated_at_epoch?: number;
};

export type ImportHistoryRow = {
  entity?: string;
  status?: string;
  message?: string;
  rows_seen?: number;
  rows_imported?: number;
  errors?: string[];
  bucket?: string;
  key?: string;
  filename?: string;
  view_counts?: Record<string, number>;
  updated_at_epoch?: number;
  source_key?: string;
};

export type ImportHistoryResponse = {
  rows: ImportHistoryRow[];
  count: number;
  checklist: ImportChecklistItem[];
};

export type ImportPreviewResponse = {
  entity: string;
  bucket: string;
  key: string;
  filename: string;
  row_count_estimate: number;
  detected_columns: string[];
  required_columns: string[];
  suggested_mapping: Record<string, string>;
  sample_rows: Record<string, unknown>[];
  mapped_sample_rows: Record<string, unknown>[];
  validation: {
    missing_mappings: string[];
    sample_errors: string[];
    status: "ready" | "needs_mapping";
  };
};

export type ImportCommitResponse = {
  entity: string;
  bucket: string;
  key: string;
  status: "queued";
  rows_seen: number;
  message: string;
};

export type AuditEventRow = {
  action: string;
  resource: string;
  user: string;
  origin?: string;
  source_ip?: string;
  details?: Record<string, unknown>;
  created_at_epoch: number;
};

export type AuditEventsResponse = {
  rows: AuditEventRow[];
  count: number;
};

export type MonitoringCheck = {
  name: string;
  status: "ok" | "attention" | "warning" | "checking";
  count: number;
  message: string;
};

export type MonitoringEventRow = {
  event_type?: string;
  action?: string;
  status?: string;
  resource?: string;
  message?: string;
  user?: string;
  details?: Record<string, unknown>;
  created_at_epoch?: number;
  updated_at_epoch?: number;
};

export type MonitoringSummaryResponse = {
  generated_at_epoch: number;
  window_hours: number;
  checks: MonitoringCheck[];
  events: MonitoringEventRow[];
  storage: string;
};

export type ActionReviewRow = {
  action_key: string;
  status: "open" | "accepted" | "dismissed";
  note?: string;
  action_snapshot?: Record<string, unknown>;
  updated_by?: string;
  approved_by?: string;
  approved_at?: string;
  approved_at_epoch?: number;
  updated_at?: string;
  updated_at_epoch?: number;
};

export type ActionReviewsResponse = {
  rows: ActionReviewRow[];
  count: number;
  storage?: "server" | "browser";
};

export type ForecastValidationResponse = {
  summary: {
    sku_count: number;
    horizon_days: number;
    median_absolute_percentage_error: number | null;
    weighted_absolute_percentage_error: number | null;
    total_forecast_quantity: number;
    total_actual_quantity: number;
    low_confidence_skus: number;
  };
  rows: Record<string, unknown>[];
};

export type ActionReviewUpsertResponse = {
  row: ActionReviewRow;
  storage?: "server" | "browser";
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("stocksense-auth"));
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("stocksense-auth"));
}

function redirectToLogin(): void {
  if (IS_DEMO_MODE || typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
}

function requireCognitoToken(): void {
  if (!IS_COGNITO_AUTH || getAuthToken()) return;
  redirectToLogin();
  throw new Error("Login required.");
}

function authRedirectUri(): string {
  if (COGNITO_REDIRECT_URI) return COGNITO_REDIRECT_URI;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/login`;
}

function authLogoutUri(): string {
  if (COGNITO_LOGOUT_URI) return COGNITO_LOGOUT_URI;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/login`;
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function randomString(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

export async function startCognitoLogin(nextPath = "/"): Promise<void> {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error("Secure sign-in is not configured.");
  }
  const verifier = randomString();
  const challenge = base64Url(await sha256(verifier));
  const state = randomString(24);
  window.localStorage.setItem(COGNITO_CODE_VERIFIER_KEY, verifier);
  window.localStorage.setItem(COGNITO_STATE_KEY, state);
  window.localStorage.setItem(COGNITO_NEXT_KEY, nextPath || "/");

  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: authRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state
  });
  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

export async function completeCognitoLoginFromUrl(): Promise<string | null> {
  if (typeof window === "undefined" || !IS_COGNITO_AUTH) return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;
  const state = params.get("state") || "";
  const expectedState = window.localStorage.getItem(COGNITO_STATE_KEY) || "";
  const verifier = window.localStorage.getItem(COGNITO_CODE_VERIFIER_KEY) || "";
  if (!expectedState || state !== expectedState || !verifier) {
    throw new Error("Sign-in could not be verified. Please try again.");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: authRedirectUri(),
    code_verifier: verifier
  });
  const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    throw new Error(`Sign-in failed: ${response.status}`);
  }
  const tokenBody = await response.json();
  const authToken = tokenBody.id_token || tokenBody.access_token;
  if (!authToken) {
    throw new Error("The sign-in service did not return a valid session.");
  }
  setAuthToken(String(authToken));
  window.localStorage.removeItem(COGNITO_CODE_VERIFIER_KEY);
  window.localStorage.removeItem(COGNITO_STATE_KEY);
  const next = window.localStorage.getItem(COGNITO_NEXT_KEY) || "/";
  window.localStorage.removeItem(COGNITO_NEXT_KEY);
  window.history.replaceState({}, "", "/login");
  return next;
}

export function cognitoLogoutUrl(): string | null {
  if (!IS_COGNITO_AUTH || !COGNITO_DOMAIN || !COGNITO_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    logout_uri: authLogoutUri()
  });
  return `${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(status: number): void {
  if (status !== 401 || IS_DEMO_MODE || typeof window === "undefined") return;
  clearAuthToken();
  redirectToLogin();
}

export async function apiGet<T>(path: string): Promise<T> {
  if (IS_DEMO_MODE) {
    const demo = getDemoGet(path);
    if (demo) return demo as T;
  }
  requireCognitoToken();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: authHeaders()
    });
    if (!response.ok) {
      handleUnauthorized(response.status);
      throw new Error(`API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (IS_DEMO_MODE) {
      const demo = getDemoGet(path);
      if (demo) return demo as T;
    }
    throw error;
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (IS_DEMO_MODE) {
    const demo = getDemoPost(path, body);
    if (demo) return demo as T;
  }
  requireCognitoToken();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      handleUnauthorized(response.status);
      const errorBody = await response.json().catch(() => null);
      const detail = errorBody?.detail;
      if (typeof detail === "object" && detail?.errors) {
        throw new Error(detail.errors.join(" "));
      }
      if (typeof detail === "object" && detail?.message) {
        throw new Error(String(detail.message));
      }
      throw new Error(typeof detail === "string" ? detail : `API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (IS_DEMO_MODE) {
      const demo = getDemoPost(path, body);
      if (demo) return demo as T;
    }
    throw error;
  }
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  requireCognitoToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.detail;
    if (typeof detail === "object" && detail?.errors) {
      throw new Error(detail.errors.join(" "));
    }
    throw new Error(typeof detail === "string" ? detail : `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || "Login failed");
  }
  const body = (await response.json()) as LoginResponse;
  setAuthToken(body.access_token);
  return body;
}

export async function loginWithCognitoPassword(username: string, password: string): Promise<LoginResponse> {
  if (!COGNITO_CLIENT_ID) {
    throw new Error("Secure sign-in is not configured.");
  }
  const response = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth"
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.Message || body?.__type || "Sign-in failed.";
    throw new Error(String(message).replace(/^.*?#/, ""));
  }
  if (body?.ChallengeName) {
    throw new Error("This account needs an additional sign-in step. Use company sign-in instead.");
  }
  const authToken = body?.AuthenticationResult?.IdToken || body?.AuthenticationResult?.AccessToken;
  if (!authToken) {
    throw new Error("The sign-in service did not return a valid session.");
  }
  setAuthToken(String(authToken));
  return {
    access_token: String(authToken),
    token_type: "bearer",
    user: { username }
  };
}

export function formatCurrency(value: unknown): string {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(numberValue);
}

export function formatNumber(value: unknown): string {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1
  }).format(numberValue);
}
