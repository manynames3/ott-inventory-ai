import Link from "next/link";

import { StatusPill } from "@/components/status-pill";

type DataTableProps = {
  columns: string[];
  rows: Record<string, unknown>[];
  emptyLabel?: string;
};

function formatHeader(column: string) {
  return column.replaceAll("_", " ");
}

function formatCell(column: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (column.includes("confidence") && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return String(value);
}

export function DataTable({ columns, rows, emptyLabel = "No rows" }: DataTableProps) {
  if (!rows.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{formatHeader(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => {
                const value = row[column];
                if (column === "sku" && value) {
                  return (
                    <td key={column}>
                      <Link href={`/sku?sku=${encodeURIComponent(String(value))}`} className="table-link">
                        {String(value)}
                      </Link>
                    </td>
                  );
                }
                if (column === "customer_id" && value) {
                  return (
                    <td key={column}>
                      <Link href={`/customers?customerId=${encodeURIComponent(String(value))}`} className="table-link">
                        {String(value)}
                      </Link>
                    </td>
                  );
                }
                if (column === "status" || column === "risk_level" || column === "risk_bucket") {
                  return (
                    <td key={column}>
                      <StatusPill value={value} />
                    </td>
                  );
                }
                return <td key={column}>{formatCell(column, value)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
