import { getDemoGet, getDemoPost } from "@/lib/demo-data";

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const TOKEN_KEY = "inventory_ai_access_token";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: { username: string };
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
  columns: string[];
  rows: Record<string, unknown>[];
  safe_query_mode: string;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("inventory-ai-auth"));
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("inventory-ai-auth"));
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(status: number): void {
  if (status !== 401 || IS_DEMO_MODE || typeof window === "undefined") return;
  clearAuthToken();
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  if (IS_DEMO_MODE) {
    const demo = getDemoGet(path);
    if (demo) return demo as T;
  }

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
      throw new Error(errorBody?.detail || `API request failed: ${response.status}`);
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
