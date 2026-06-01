import { ArrowDownRight, ArrowUpRight, CircleAlert, Clock3, DollarSign } from "lucide-react";

const iconMap = {
  value: DollarSign,
  risk: CircleAlert,
  stockout: Clock3,
  reorder: ArrowUpRight,
  waste: ArrowDownRight
};

type MetricCardProps = {
  label: string;
  value: string;
  tone: keyof typeof iconMap;
};

export function MetricCard({ label, value, tone }: MetricCardProps) {
  const Icon = iconMap[tone];
  return (
    <section className={`metric-card tone-${tone}`}>
      <div className="metric-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

