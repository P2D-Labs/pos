import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Monitor,
  Package,
  PanelLeftClose,
  PanelRightClose,
  Receipt,
  ScrollText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Tag,
  Truck,
  Undo2,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getAuthState, setAuthState } from "../models/auth";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentPage } from "../pages/DocumentPage";
import { InventoryPage } from "../pages/InventoryPage";
import { ItemsPage } from "../pages/ItemsPage";
import { ItemEditorPage } from "../pages/ItemEditorPage";
import { CustomersPage } from "../pages/CustomersPage";
import { CustomerEditorPage } from "../pages/CustomerEditorPage";
import { ModulePage } from "../pages/ModulePage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { PosPage } from "../pages/PosPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SalesReturnPage } from "../pages/SalesReturnPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { RolesPage } from "../pages/RolesPage";
import { SuppliersPage } from "../pages/SuppliersPage";
import { SupplierEditorPage } from "../pages/SupplierEditorPage";
import { UsersPage } from "../pages/UsersPage";
import { applyThemePrimaryCss } from "../lib/theme";
import { api } from "../services/api";
import { moduleConfigs } from "../services/module.service";
import { ConfirmModal } from "./ui/ConfirmModal";

const SIDEBAR_KEY = "pos-sidebar-collapsed";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/roles": ShieldCheck,
  "/users": UserRoundCog,
  "/customers": Users,
  "/suppliers": Truck,
  "/items": Package,
  "/pos": ShoppingCart,
  "/quotations": FileText,
  "/sales-orders": ClipboardList,
  "/sales-invoices": Receipt,
  "/purchases": ShoppingBag,
  "/sales-returns": Undo2,
  "/payments": CreditCard,
  "/ledger": ScrollText,
  "/tax-rates": Receipt,
  "/units": Boxes,
  "/categories": ClipboardList,
  "/brands": Tag,
  "/settings": Settings,
  "/sessions": Monitor,
  "/inventory": Boxes,
  "/reports": BarChart3,
  "/audit-logs": ScrollText,
};

function toToggleKey(pathname: string) {
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes("*") || permissions.includes(permission);
}

function requiredPermissionForPath(path: string): string | null {
  if (path === "/") return "business.view";
  if (path.startsWith("/roles")) return "roles.view";
  if (path.startsWith("/users")) return "users.view";
  if (path.startsWith("/customers")) return "customers.view";
  if (path.startsWith("/suppliers")) return "suppliers.view";
  if (path.startsWith("/items")) return "products.view";
  if (path.startsWith("/pos")) return "sales.view";
  if (path.startsWith("/quotations")) return "sales.view";
  if (path.startsWith("/sales-orders")) return "sales.view";
  if (path.startsWith("/sales-invoices")) return "sales.view";
  if (path.startsWith("/purchases")) return "purchases.view";
  if (path.startsWith("/sales-returns")) return "returns.view";
  if (path.startsWith("/payments")) return "payments.view";
  if (path.startsWith("/ledger")) return "ledger.view";
  if (path.startsWith("/tax-rates")) return "taxRates.view";
  if (path.startsWith("/units")) return "units.view";
  if (path.startsWith("/categories")) return "categories.view";
  if (path.startsWith("/brands")) return "brands.view";
  if (path.startsWith("/settings")) return "settings.view";
  if (path.startsWith("/sessions")) return "sessions.view";
  if (path.startsWith("/inventory")) return "inventory.view";
  if (path.startsWith("/reports")) return "reports.view";
  if (path.startsWith("/audit-logs")) return "audit.view";
  return null;
}

function hasPermissionForModulePath(permissions: string[], required: string | null) {
  if (!required) return true;
  return hasPermission(permissions, required);
}

function isPathAllowed(pathname: string, allowedModulePaths: string[]) {
  return allowedModulePaths.some((basePath) => {
    if (basePath === "/") return pathname === "/";
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  });
}

export function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuthState();
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean> | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  useEffect(() => {
    function onFs() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    async function loadToggles() {
      try {
        const response = await api.get("/settings/customization");
        const toggles = response.data?.data?.moduleToggles;
        const themeConfig = response.data?.data?.themeConfig as
          | { primaryColor?: string; radius?: number; fontFamily?: string }
          | undefined;
        if (themeConfig?.primaryColor) {
          applyThemePrimaryCss(themeConfig.primaryColor);
        }
        if (typeof themeConfig?.radius === "number") {
          document.documentElement.style.setProperty("--radius", `${themeConfig.radius}px`);
        }
        if (themeConfig?.fontFamily) {
          document.documentElement.style.setProperty(
            "--font-body",
            `${themeConfig.fontFamily}, "Inter", "Segoe UI", Roboto, Arial, sans-serif`,
          );
        }
        if (toggles && typeof toggles === "object") {
          setModuleToggles(toggles as Record<string, boolean>);
        } else {
          setModuleToggles(null);
        }
      } catch {
        setModuleToggles(null);
      }
    }
    void loadToggles();
  }, []);

  const visibleModules = useMemo(() => {
    const permissions = auth?.permissions ?? [];
    return moduleConfigs.filter((module) => {
      const toggleKey = toToggleKey(module.path);
      const isEnabled = !toggleKey || !moduleToggles || moduleToggles[toggleKey] !== false;
      if (!isEnabled) return false;
      const requiredPermission = requiredPermissionForPath(module.path);
      return hasPermissionForModulePath(permissions, requiredPermission);
    });
  }, [auth?.accessToken, moduleToggles]);

  useEffect(() => {
    if (!auth) return;
    const allowedPaths = visibleModules.map((module) => module.path);
    if (isPathAllowed(location.pathname, allowedPaths)) return;
    navigate(visibleModules[0]?.path ?? "/login", { replace: true });
  }, [location.pathname, navigate, visibleModules, auth]);

  async function performLogout() {
    const session = getAuthState();
    if (session?.refreshToken) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      } catch {
        // keep logout resilient in UI
      }
    }
    setAuthState(null);
    navigate("/login");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }

  const currentTitle = visibleModules.find((m) => m.path === location.pathname)?.title ?? "Panel";

  if (!auth) return <Navigate to="/login" replace />;

  return (
    <div className={`layout${sidebarCollapsed ? " layout--collapsed" : ""}${mobileNavOpen ? " layout--nav-open" : ""}`}>
      {mobileNavOpen ? (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar__brand">
          <div className="sidebar__logo" aria-hidden>
            P
          </div>
          <div className="sidebar__brand-text">
            <div className="sidebar__title">P2D Labs</div>
            <div className="sidebar__subtitle">POS Suite</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {visibleModules.map((item) => {
            const Icon = NAV_ICONS[item.path] ?? FileText;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                className={`sidebar__link${active ? " is-active" : ""}`}
                onClick={() => navigate(item.path)}
                title={item.title}
              >
                <span className="sidebar__link-icon">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="sidebar__nav-label">{item.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <button type="button" className="sidebar__link" onClick={() => setLogoutConfirmOpen(true)} title="Logout">
            <span className="sidebar__link-icon">
              <LogOut size={20} strokeWidth={2} />
            </span>
            <span className="sidebar__nav-label">Logout</span>
          </button>
          <div className="sidebar__footer-copy">© {new Date().getFullYear()} P2D Labs</div>
        </div>
      </aside>

      <ConfirmModal
        open={logoutConfirmOpen}
        title="Sign out?"
        message="You will need to sign in again to access the panel."
        confirmLabel="Logout"
        danger
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void performLogout();
        }}
      />

      <div className="layout-main">
        <header className="topbar">
          <button
            type="button"
            className="btn-icon mobile-only"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="btn-icon desktop-only"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            {sidebarCollapsed ? <PanelRightClose size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <span className="topbar__title">{currentTitle}</span>
          <div className="topbar__spacer" />
          <button type="button" className="btn-icon" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </header>

        <Routes>
          {visibleModules.map((module) => {
            if (module.path === "/") {
              return <Route key={module.path} path={module.path} element={<DashboardPage />} />;
            }
            if (module.path === "/quotations") {
              return (
                <Route
                  key={module.path}
                  path={module.path}
                  element={<DocumentPage title={module.title} listEndpoint="/quotations" createEndpoint="/quotations" kind="quotation" />}
                />
              );
            }
            if (module.path === "/sales-orders") {
              return (
                <Route
                  key={module.path}
                  path={module.path}
                  element={<DocumentPage title={module.title} listEndpoint="/sales-orders" createEndpoint="/sales-orders" kind="sales-order" />}
                />
              );
            }
            if (module.path === "/sales-invoices") {
              return (
                <Route
                  key={module.path}
                  path={module.path}
                  element={
                    <DocumentPage title={module.title} listEndpoint="/sales-invoices" createEndpoint="/sales-invoices" kind="sales-invoice" />
                  }
                />
              );
            }
            if (module.path === "/purchases") {
              return (
                <Route
                  key={module.path}
                  path={module.path}
                  element={<DocumentPage title={module.title} listEndpoint="/purchases" createEndpoint="/purchases" kind="purchase" />}
                />
              );
            }
            if (module.path === "/pos") {
              return <Route key={module.path} path={module.path} element={<PosPage />} />;
            }
            if (module.path === "/sales-returns") {
              return <Route key={module.path} path={module.path} element={<SalesReturnPage />} />;
            }
            if (module.path === "/payments") {
              return <Route key={module.path} path={module.path} element={<PaymentsPage />} />;
            }
            if (module.path === "/settings") {
              return <Route key={module.path} path={module.path} element={<SettingsPage />} />;
            }
            if (module.path === "/roles") {
              return <Route key={module.path} path={module.path} element={<RolesPage />} />;
            }
            if (module.path === "/users") {
              return <Route key={module.path} path={module.path} element={<UsersPage />} />;
            }
            if (module.path === "/sessions") {
              return <Route key={module.path} path={module.path} element={<SessionsPage />} />;
            }
            if (module.path === "/inventory") {
              return <Route key={module.path} path={module.path} element={<InventoryPage />} />;
            }
            if (module.path === "/customers") {
              return [
                <Route key={`${module.path}-list`} path={module.path} element={<CustomersPage />} />,
                <Route key={`${module.path}-new`} path="/customers/new" element={<CustomerEditorPage />} />,
                <Route key={`${module.path}-edit`} path="/customers/:id/edit" element={<CustomerEditorPage />} />,
              ];
            }
            if (module.path === "/suppliers") {
              return [
                <Route key={`${module.path}-list`} path={module.path} element={<SuppliersPage />} />,
                <Route key={`${module.path}-new`} path="/suppliers/new" element={<SupplierEditorPage />} />,
                <Route key={`${module.path}-edit`} path="/suppliers/:id/edit" element={<SupplierEditorPage />} />,
              ];
            }
            if (module.path === "/items") {
              return [
                <Route key={`${module.path}-list`} path={module.path} element={<ItemsPage />} />,
                <Route key={`${module.path}-new`} path="/items/new" element={<ItemEditorPage />} />,
                <Route key={`${module.path}-edit`} path="/items/:id/edit" element={<ItemEditorPage />} />,
              ];
            }
            if (module.path === "/reports") {
              return <Route key={module.path} path={module.path} element={<ReportsPage />} />;
            }
            return (
              <Route
                key={module.path}
                path={module.path}
                element={<ModulePage title={module.title} endpoint={module.endpoint} createFields={module.createFields} />}
              />
            );
          })}
        </Routes>
      </div>
    </div>
  );
}
