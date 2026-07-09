"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  X
} from "lucide-react";

import {
  AuthMeResponse,
  IS_DEMO_MODE,
  TableResponse,
  WORKSPACE_NAME,
  apiGet,
  clearAuthToken,
  cognitoLogoutUrl,
  getAuthToken
} from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  adminOnly?: boolean;
};

type SearchResult = {
  href: string;
  title: string;
  subtitle: string;
  kind: "Page" | "SKU" | "Customer";
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Overview", icon: BarChart3 },
      { href: "/actions", label: "Priority actions", icon: ListChecks },
      { href: "/validation", label: "Forecast quality", icon: TrendingUp }
    ]
  },
  {
    label: "Data",
    items: [
      { href: "/onboarding", label: "Data setup", icon: ClipboardCheck },
      { href: "/imports", label: "Imports", icon: UploadCloud }
    ]
  },
  {
    label: "Insights",
    items: [
      { href: "/query", label: "Ask StockSense", icon: Sparkles },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/audit", label: "Audit trail", icon: ShieldCheck }
    ]
  },
  {
    label: "Workspace",
    items: [
      { href: "/status", label: "System status", icon: Activity },
      { href: "/admin", label: "Settings", icon: Settings, adminOnly: true },
      { href: "/users", label: "User access", icon: Users, adminOnly: true }
    ]
  }
];

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/actions": "Priority actions",
  "/validation": "Forecast quality",
  "/onboarding": "Data setup",
  "/imports": "Imports",
  "/query": "Ask StockSense",
  "/reports": "Reports",
  "/audit": "Audit trail",
  "/status": "System status",
  "/security": "Security and data handling",
  "/admin": "Workspace settings",
  "/users": "User access",
  "/sku": "SKU detail",
  "/customers": "Customer detail"
};

function displayName(username?: string) {
  if (!username) return "Workspace user";
  const localPart = username.split("@")[0] || username;
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(username?: string) {
  const parts = displayName(username).split(" ").filter(Boolean);
  return `${parts[0]?.[0] || "W"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function matchesPath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(href);
}

function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null);
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthMeResponse["user"] | null>(null);
  const [hasSession, setHasSession] = useState(IS_DEMO_MODE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<{ products: Record<string, unknown>[]; customers: Record<string, unknown>[] } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isMarketingPage = pathname === "/sales" || pathname === "/sales/" || pathname === "/landing" || pathname === "/landing/";
  const isAuthPage = pathname === "/login" || pathname === "/login/";
  const isAdmin = currentUser?.role === "admin";

  const visibleNavGroups = useMemo(
    () => navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || isAdmin) })),
    [isAdmin]
  );
  const visibleNavItems = useMemo(() => visibleNavGroups.flatMap((group) => group.items), [visibleNavGroups]);
  const pageTitle = Object.entries(routeTitles).find(([href]) => matchesPath(pathname, href))?.[1] || "StockSense AI";

  useEffect(() => {
    if (isMarketingPage || isAuthPage) return;
    let active = true;

    async function syncUser() {
      const token = getAuthToken();
      setHasSession(IS_DEMO_MODE || Boolean(token));
      if (!IS_DEMO_MODE && !token) {
        const next = encodeURIComponent(pathname || "/");
        window.location.replace(`/login?next=${next}`);
        return;
      }
      try {
        const body = await apiGet<AuthMeResponse>("/api/auth/me");
        if (active) setCurrentUser(body.user);
      } catch {
        if (active) setCurrentUser(null);
      }
    }

    void syncUser();
    window.addEventListener("stocksense-auth", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      active = false;
      window.removeEventListener("stocksense-auth", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, [isAuthPage, isMarketingPage, pathname]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        void openSearch();
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
        setUserMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>("button, a")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
    };
  }, [sidebarOpen]);

  async function loadSearchData() {
    if (searchData || searchLoading) return;
    setSearchLoading(true);
    setSearchError(null);
    const [products, customers] = await Promise.allSettled([
      apiGet<TableResponse>("/api/products?limit=100"),
      apiGet<TableResponse>("/api/customers?limit=100")
    ]);
    const productRows = products.status === "fulfilled" ? products.value.rows : [];
    const customerRows = customers.status === "fulfilled" ? customers.value.rows : [];
    setSearchData({ products: productRows, customers: customerRows });
    if (products.status === "rejected" || customers.status === "rejected") {
      setSearchError("Some records could not be loaded. Page navigation is still available.");
    }
    setSearchLoading(false);
  }

  async function openSearch() {
    setSearchOpen(true);
    setSidebarOpen(false);
    setUserMenuOpen(false);
    await loadSearchData();
  }

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const pageResults = visibleNavItems
      .filter((item) => !query || item.label.toLowerCase().includes(query))
      .map((item) => ({ href: item.href, title: item.label, subtitle: "Open workspace page", kind: "Page" as const }));
    if (!query) return pageResults.slice(0, 7);

    const productResults = (searchData?.products || [])
      .filter((row) => [row.sku, row.name, row.category].some((value) => String(value || "").toLowerCase().includes(query)))
      .map((row) => ({
        href: `/sku?sku=${encodeURIComponent(String(row.sku || ""))}`,
        title: String(row.sku || "Unknown SKU"),
        subtitle: [row.name, row.category].filter(Boolean).join(" · "),
        kind: "SKU" as const
      }));
    const customerResults = (searchData?.customers || [])
      .filter((row) => [row.customer_id, row.name, row.region, row.channel].some((value) => String(value || "").toLowerCase().includes(query)))
      .map((row) => ({
        href: `/customers?customerId=${encodeURIComponent(String(row.customer_id || ""))}`,
        title: String(row.name || row.customer_id || "Unknown customer"),
        subtitle: [row.customer_id, row.region, row.channel].filter(Boolean).join(" · "),
        kind: "Customer" as const
      }));
    return [...pageResults, ...productResults, ...customerResults].slice(0, 12);
  }, [searchData, searchQuery, visibleNavItems]);

  function signOut() {
    clearAuthToken();
    const logoutUrl = cognitoLogoutUrl();
    window.location.href = logoutUrl || "/login";
  }

  if (isMarketingPage || isAuthPage) return <>{children}</>;

  const username = currentUser?.username;
  const role = currentUser?.role || (IS_DEMO_MODE ? "demo" : "access loading");

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className={sidebarOpen ? "app-shell sidebar-is-open" : "app-shell"}>
        <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
        <aside className="sidebar" id="primary-navigation" aria-label="Workspace navigation" ref={sidebarRef} onKeyDown={keepFocusInside}>
          <div className="sidebar-header">
            <Link href="/" className="brand app-brand-lockup" onClick={() => setSidebarOpen(false)}>
              <img className="app-brand-mark" src="/assets/stocksense-ottogi-logo.svg" alt="" aria-hidden="true" />
              <span>
                <strong>StockSense AI</strong>
                <small>{WORKSPACE_NAME}</small>
              </span>
            </Link>
            <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
              <X size={19} />
            </button>
          </div>
          <nav className="nav-list" aria-label="Primary navigation">
            {visibleNavGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = matchesPath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={isActive ? "nav-item nav-item-active" : "nav-item"}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={18} aria-hidden={true} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <footer className="app-shell-footer">
            <strong>StockSense AI</strong>
            <span>©2026 SUPREME AI VENTURES LLC</span>
          </footer>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <div className="topbar-context">
              <button
                ref={menuButtonRef}
                className="mobile-menu-button"
                type="button"
                aria-label="Open navigation"
                aria-controls="primary-navigation"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div>
                <span>{WORKSPACE_NAME}</span>
                <strong>{pageTitle}</strong>
              </div>
            </div>

            <button className="global-search-trigger" type="button" onClick={() => void openSearch()} aria-keyshortcuts="Meta+K Control+K">
              <Search size={17} aria-hidden="true" />
              <span>Search pages, SKUs, and customers</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="account-menu-wrap">
              <button
                className="account-menu-button"
                type="button"
                aria-label="Open account menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((current) => !current)}
              >
                <span>
                  <strong>{displayName(username)}</strong>
                  <small>{role.replaceAll("_", " ")}</small>
                </span>
                <i aria-hidden="true">{initials(username)}</i>
              </button>
              {userMenuOpen ? (
                <>
                  <div className="popover-scrim" role="presentation" onMouseDown={() => setUserMenuOpen(false)} />
                  <div className="account-popover" role="menu">
                    <div className="account-popover-header">
                      <strong>{displayName(username)}</strong>
                      <span>{username || (IS_DEMO_MODE ? "Demo workspace" : "Signed-in workspace user")}</span>
                    </div>
                    <Link href="/security" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      <LockKeyhole size={16} />
                      Security and data handling
                    </Link>
                    <Link href="/status" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      <Activity size={16} />
                      System status
                    </Link>
                    {IS_DEMO_MODE || !hasSession ? (
                      <Link href="/login" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                        <LogIn size={16} />
                        Sign in
                      </Link>
                    ) : (
                      <button type="button" role="menuitem" onClick={signOut}>
                        <LogOut size={16} />
                        Sign out
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </header>
          <main className="content" id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>

      {searchOpen ? (
        <div className="dialog-backdrop search-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}>
          <section className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-search-title" onKeyDown={keepFocusInside}>
            <header>
              <Search size={19} aria-hidden="true" />
              <div>
                <h2 id="command-search-title">Search StockSense</h2>
                <p>Jump to a page or open a SKU or customer record.</p>
              </div>
              <button className="dialog-close" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <label className="command-search-field">
              <span className="sr-only">Search pages, SKUs, and customers</span>
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Type a page, SKU, product, or customer"
                autoComplete="off"
                aria-label="Search pages, SKUs, and customers"
              />
              <kbd>Esc</kbd>
            </label>
            {searchError ? <div className="message warning" role="status">{searchError}</div> : null}
            <div className="command-results" aria-live="polite">
              <div className="command-results-meta">
                <span>{searchQuery.trim() ? "Results" : "Workspace pages"}</span>
                <strong>{searchLoading ? "Loading records..." : `${searchResults.length} available`}</strong>
              </div>
              {searchResults.length ? (
                searchResults.map((result) => (
                  <Link href={result.href} className="command-result" key={`${result.kind}-${result.href}`} onClick={() => setSearchOpen(false)}>
                    <span>{result.kind}</span>
                    <div>
                      <strong>{result.title}</strong>
                      <small>{result.subtitle}</small>
                    </div>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                ))
              ) : searchLoading ? (
                <div className="command-empty">Loading searchable records...</div>
              ) : (
                <div className="command-empty">No matching page, SKU, or customer was found.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
