import Link from "next/link";

import { StatusPill } from "@/components/status-pill";

type DataTableProps = {
  columns: string[];
  rows: Record<string, unknown>[];
  emptyLabel?: string;
  tableClassName?: string;
  ariaLabel?: string;
};

function formatHeader(column: string) {
  const label = column.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCell(column: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (column.includes("confidence") && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if ((column.includes("value") || column.includes("cost")) && typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return String(value);
}

export function DataTable({ columns, rows, emptyLabel = "No rows", tableClassName = "", ariaLabel }: DataTableProps) {
  if (!rows.length) {
    return <div className="empty-state" role="status">{emptyLabel}</div>;
  }

  return (
    <div className="table-scroll">
      <table className={`data-table${tableClassName ? ` ${tableClassName}` : ""}`} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} data-column={column} scope="col">
                {formatHeader(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${columns.map((column) => String(row[column] ?? "")).join("|")}-${index}`}>
              {columns.map((column) => {
                const value = row[column];
                if (column === "sku" && value) {
                  return (
                    <td key={column} data-column={column}>
                      <Link href={`/sku?sku=${encodeURIComponent(String(value))}`} className="table-link">
                        {String(value)}
                      </Link>
                    </td>
                  );
                }
                if (column === "customer_id" && value) {
                  return (
                    <td key={column} data-column={column}>
                      <Link href={`/customers?customerId=${encodeURIComponent(String(value))}`} className="table-link">
                        {String(value)}
                      </Link>
                    </td>
                  );
                }
                if (column === "status" || column === "risk_level" || column === "risk_bucket") {
                  return (
                    <td key={column} data-column={column}>
                      <StatusPill value={value} />
                    </td>
                  );
                }
                return (
                  <td key={column} data-column={column}>
                    {formatCell(column, value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
