import type { ModuleConfig } from "../models/module.model";

export const moduleConfigs: ModuleConfig[] = [
  { path: "/", title: "Dashboard", endpoint: "/business/dashboard" },
  {
    path: "/customers",
    title: "Customers",
    endpoint: "/customers",
    createFields: [
      { name: "name", label: "Customer name" },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email" },
    ],
  },
  {
    path: "/suppliers",
    title: "Suppliers",
    endpoint: "/suppliers",
    createFields: [
      { name: "name", label: "Supplier name" },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email" },
    ],
  },
  {
    path: "/items",
    title: "Items",
    endpoint: "/items",
    createFields: [
      { name: "name", label: "Item name" },
      { name: "salesPricePrimary", label: "Sales price", type: "number" },
      { name: "purchasePricePrimary", label: "Purchase price", type: "number" },
    ],
  },
  { path: "/pos", title: "POS / Till", endpoint: "/sales-invoices" },
  { path: "/quotations", title: "Quotations", endpoint: "/quotations" },
  { path: "/sales-orders", title: "Sales Orders", endpoint: "/sales-orders" },
  { path: "/sales-invoices", title: "Sales Invoices", endpoint: "/sales-invoices" },
  { path: "/purchases", title: "Purchases", endpoint: "/purchases" },
  { path: "/sales-returns", title: "Sales Returns", endpoint: "/sales-returns" },
  { path: "/payments", title: "Payments", endpoint: "/payments" },
  { path: "/refunds", title: "Refunds", endpoint: "/refunds" },
  {
    path: "/expenses",
    title: "Expenses",
    endpoint: "/expenses",
    createFields: [
      { name: "category", label: "Category" },
      { name: "paidTo", label: "Paid to" },
      { name: "amount", label: "Amount", type: "number" },
      { name: "paymentMethod", label: "Payment method" },
      { name: "note", label: "Note" },
    ],
  },
  { path: "/settings", title: "Settings", endpoint: "/settings/customization" },
  { path: "/sessions", title: "Device Sessions", endpoint: "/auth/sessions" },
  { path: "/inventory", title: "Inventory", endpoint: "/stock-transactions" },
  { path: "/pricing", title: "Pricing", endpoint: "/items/:id/resolved-price" },
  { path: "/reports", title: "Reports", endpoint: "/reports/dashboard" },
  { path: "/print-center", title: "Print Center", endpoint: "/print/reprint-search" },
  { path: "/audit-logs", title: "Audit Logs", endpoint: "/audit-logs" },
];
