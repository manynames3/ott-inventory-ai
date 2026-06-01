const toneByStatus: Record<string, string> = {
  "stockout risk": "pill-danger",
  "reorder now": "pill-warning",
  wait: "pill-neutral",
  overstocked: "pill-info",
  critical: "pill-danger",
  high: "pill-warning",
  medium: "pill-info",
  normal: "pill-neutral"
};

export function StatusPill({ value }: { value: unknown }) {
  const label = String(value ?? "");
  const tone = toneByStatus[label.toLowerCase()] || "pill-neutral";
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

