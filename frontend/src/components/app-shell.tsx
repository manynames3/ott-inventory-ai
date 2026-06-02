"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BarChart3, ListChecks, LogIn, LogOut, Search, UploadCloud } from "lucide-react";

import { clearAuthToken, getAuthToken, IS_DEMO_MODE } from "@/lib/api";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/imports", label: "Imports", icon: UploadCloud },
  { href: "/query", label: "Query", icon: Search }
];

export function AppShell({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(false);
  const pathname = usePathname();
  const isMarketingPage = pathname === "/sales" || pathname === "/sales/" || pathname === "/landing" || pathname === "/landing/";

  useEffect(() => {
    function syncToken() {
      setHasToken(Boolean(getAuthToken()));
    }
    syncToken();
    window.addEventListener("inventory-ai-auth", syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener("inventory-ai-auth", syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  if (isMarketingPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand app-brand-lockup">
          <span className="app-brand-mark" aria-hidden="true">
            <span>AI</span>
          </span>
          <span>
            <strong>O&apos;Inventory</strong>
            <small>Inventory AI pilot</small>
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
          {IS_DEMO_MODE || !hasToken ? (
            <Link href="/login" className="nav-item">
              <LogIn size={18} />
              <span>Login</span>
            </Link>
          ) : (
            <button className="nav-item nav-button" type="button" onClick={clearAuthToken}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          )}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
