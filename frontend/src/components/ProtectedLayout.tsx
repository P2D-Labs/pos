import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getAuthState, setAuthState } from "../models/auth";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentPage } from "../pages/DocumentPage";
import { InventoryPage } from "../pages/InventoryPage";
import { ModulePage } from "../pages/ModulePage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { PosPage } from "../pages/PosPage";
import { PricingPage } from "../pages/PricingPage";
import { PrintCenterPage } from "../pages/PrintCenterPage";
import { ReportsPage } from "../pages/ReportsPage";
import { RefundsPage } from "../pages/RefundsPage";
import { SalesReturnPage } from "../pages/SalesReturnPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { api } from "../services/api";
import { moduleConfigs } from "../services/module.service";

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
  if (path.startsWith("/refunds")) return "refunds.view";
  if (path.startsWith("/expenses")) return "expenses.view";
  if (path.startsWith("/settings")) return "settings.view";
  if (path.startsWith("/sessions")) return "sessions.view";
  if (path.startsWith("/inventory")) return "inventory.view";
  if (path.startsWith("/pricing")) return "pricing.view";
  if (path.startsWith("/reports")) return "reports.view";
  /** Print center: any document-type view permission (targets filtered on the page). */
  if (path.startsWith("/print-center")) return "__print_center__";
  if (path.startsWith("/audit-logs")) return "audit.view";
  return null;
}

function hasPermissionForModulePath(permissions: string[], required: string | null) {
  if (!required) return true;
  if (required === "__print_center__") {
    return (
      hasPermission(permissions, "sales.view") ||
      hasPermission(permissions, "returns.view") ||
      hasPermission(permissions, "purchases.view")
    );
  }
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
  if (!auth) return <Navigate to="/login" replace />;

  useEffect(() => {
    async function loadToggles() {
      try {
        const response = await api.get("/settings/customization");
        const toggles = response.data?.data?.moduleToggles;
        const themeConfig = response.data?.data?.themeConfig as
          | { primaryColor?: string; radius?: number; fontFamily?: string }
          | undefined;
        if (themeConfig?.primaryColor) {
          document.documentElement.style.setProperty("--danger", themeConfig.primaryColor);
        }
        if (typeof themeConfig?.radius === "number") {
          document.documentElement.style.setProperty("--radius", `${themeConfig.radius}px`);
        }
        if (themeConfig?.fontFamily) {
          document.documentElement.style.setProperty("--font-body", `${themeConfig.fontFamily}, "Inter", "Segoe UI", Roboto, Arial, sans-serif`);
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
    const permissions = auth.permissions ?? [];
    return moduleConfigs.filter((module) => {
      const toggleKey = toToggleKey(module.path);
      const isEnabled = !toggleKey || !moduleToggles || moduleToggles[toggleKey] !== false;
      if (!isEnabled) return false;
      const requiredPermission = requiredPermissionForPath(module.path);
      return hasPermissionForModulePath(permissions, requiredPermission);
    });
  }, [auth.permissions, moduleToggles]);

  useEffect(() => {
    const allowedPaths = visibleModules.map((module) => module.path);
    if (isPathAllowed(location.pathname, allowedPaths)) return;
    navigate(visibleModules[0]?.path ?? "/login", { replace: true });
  }, [location.pathname, navigate, visibleModules]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">P2D Labs</div>
        <nav>
          {visibleModules.map((item) => (
            <button key={item.path} className={location.pathname === item.path ? "nav active" : "nav"} onClick={() => navigate(item.path)}>
              {item.title}
            </button>
          ))}
          <button
            className="nav"
            onClick={async () => {
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
            }}
          >
            Logout
          </button>
        </nav>
      </aside>
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
                element={<DocumentPage title={module.title} listEndpoint="/sales-invoices" createEndpoint="/sales-invoices" kind="sales-invoice" />}
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
          if (module.path === "/refunds") {
            return <Route key={module.path} path={module.path} element={<RefundsPage />} />;
          }
          if (module.path === "/settings") {
            return <Route key={module.path} path={module.path} element={<SettingsPage />} />;
          }
          if (module.path === "/sessions") {
            return <Route key={module.path} path={module.path} element={<SessionsPage />} />;
          }
          if (module.path === "/inventory") {
            return <Route key={module.path} path={module.path} element={<InventoryPage />} />;
          }
          if (module.path === "/pricing") {
            return <Route key={module.path} path={module.path} element={<PricingPage />} />;
          }
          if (module.path === "/reports") {
            return <Route key={module.path} path={module.path} element={<ReportsPage />} />;
          }
          if (module.path === "/print-center") {
            return <Route key={module.path} path={module.path} element={<PrintCenterPage />} />;
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
  );
}
