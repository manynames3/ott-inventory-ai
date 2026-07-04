"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileText,
  ListChecks,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  Users,
} from "lucide-react";

import { clearAuthToken, cognitoLogoutUrl, getAuthToken, IS_DEMO_MODE } from "@/lib/api";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/onboarding", label: "Data Setup", icon: ClipboardCheck },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/validation", label: "Validation", icon: TrendingUp },
  { href: "/imports", label: "Imports", icon: UploadCloud },
  { href: "/query", label: "Query", icon: Search },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
  { href: "/status", label: "Status", icon: Activity }
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
    window.addEventListener("stocksense-auth", syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener("stocksense-auth", syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  function signOut() {
    clearAuthToken();
    const logoutUrl = cognitoLogoutUrl();
    if (logoutUrl) {
      window.location.href = logoutUrl;
    }
  }

  if (isMarketingPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand app-brand-lockup">
          <img className="app-brand-mark" src="/assets/stocksense-ottogi-logo.svg" alt="" aria-hidden="true" />
          <span>
            <strong>StockSense AI</strong>
            <small>Ottogi operations pilot</small>
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
            <button className="nav-item nav-button" type="button" onClick={signOut}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          )}
        </nav>
        <footer className="app-shell-footer">©2026 SUPREME AI VENTURES LLC</footer>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
