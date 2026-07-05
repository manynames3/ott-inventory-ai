"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardCheck,
  CircleHelp,
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

import { clearAuthToken, cognitoLogoutUrl, getAuthToken, IS_DEMO_MODE, WORKSPACE_NAME } from "@/lib/api";

const navItems = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/actions", label: "Actions", icon: ListChecks, badge: "12" },
  { href: "/validation", label: "Forecast & Reorder", icon: TrendingUp },
  { href: "/imports", label: "Imports", icon: UploadCloud },
  { href: "/onboarding", label: "Data Setup", icon: ClipboardCheck },
  { href: "/query", label: "Query", icon: Search },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
  { href: "/status", label: "Status", icon: Activity }
];

export function AppShell({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(false);
  const pathname = usePathname();
  const isMarketingPage = pathname === "/sales" || pathname === "/sales/" || pathname === "/landing" || pathname === "/landing/";
  const isAuthPage = pathname === "/login" || pathname === "/login/";

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

  if (isMarketingPage || isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand app-brand-lockup">
          <img className="app-brand-mark" src="/assets/stocksense-ottogi-logo.svg" alt="" aria-hidden="true" />
          <span>
            <strong>StockSense AI</strong>
            <small>{WORKSPACE_NAME}</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-item${isActive ? " nav-item-active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge ? <strong className="nav-badge">{item.badge}</strong> : null}
              </Link>
            );
          })}
          {IS_DEMO_MODE || !hasToken ? (
            <Link href="/login" className="nav-item">
              <LogIn size={18} />
              <span>Sign In</span>
            </Link>
          ) : (
            <button className="nav-item nav-button" type="button" onClick={signOut}>
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          )}
        </nav>
        <footer className="app-shell-footer">
          <strong>StockSense AI</strong>
          <span>©2026 SUPREME AI VENTURES LLC</span>
        </footer>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="workspace-switcher" type="button" aria-label="Current workspace">
            <span>{WORKSPACE_NAME}</span>
            <ChevronDown size={16} />
          </button>
          <label className="global-search">
            <Search size={17} />
            <input aria-label="Search SKUs, lots, customers" placeholder="Search SKUs, lots, customers..." />
            <span>⌘K</span>
          </label>
          <div className="topbar-actions" aria-label="Workspace actions">
            <button className="topbar-icon-button" type="button" aria-label="Notifications">
              <Bell size={18} />
              <span className="topbar-alert-dot">3</span>
            </button>
            <button className="topbar-icon-button" type="button" aria-label="Help">
              <CircleHelp size={18} />
            </button>
            <div className="topbar-user" aria-label="Signed in user">
              <span>
                <strong>Jane Planner</strong>
                <small>Planner</small>
              </span>
              <i aria-hidden="true">JP</i>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
