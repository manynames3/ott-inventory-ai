import { getDemoGet, getDemoPost } from "@/lib/demo-data";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

export async function apiGet<T>(path: string): Promise<T> {
  if (IS_DEMO_MODE) {
    const demo = getDemoGet(path);
    if (demo) return demo as T;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    const demo = getDemoGet(path);
    if (demo) return demo as T;
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.detail || `API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    const demo = getDemoPost(path, body);
    if (demo) return demo as T;
    throw error;
  }
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
