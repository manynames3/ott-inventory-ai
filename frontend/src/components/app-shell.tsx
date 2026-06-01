import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Database, Search, UploadCloud } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/imports", label: "Imports", icon: UploadCloud },
  { href: "/query", label: "Query", icon: Search }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Database size={20} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Inventory AI</strong>
            <small>Food and CPG operations</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="nav-item">
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
