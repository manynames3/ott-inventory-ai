const toneByStatus: Record<string, string> = {
  "stockout risk": "pill-danger",
  "reorder now": "pill-warning",
  wait: "pill-neutral",
  overstocked: "pill-info",
  critical: "pill-danger",
  high: "pill-warning",
  medium: "pill-info",
  normal: "pill-neutral",
  expired: "pill-danger",
  "0-30 days": "pill-danger",
  "31-60 days": "pill-warning",
  "61-90 days": "pill-info",
  "90+ days": "pill-neutral"
};

export function StatusPill({ value }: { value: unknown }) {
  const label = String(value ?? "");
  const tone = toneByStatus[label.toLowerCase()] || "pill-neutral";
  return <span className={`status-pill ${tone}`}>{label}</span>;
}
