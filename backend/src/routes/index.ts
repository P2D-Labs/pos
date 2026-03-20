import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { adminRoutes } from "./admin.routes";
import { customerRoutes } from "./customers.routes";
import { inventoryRoutes } from "./inventory.routes";
import { productRoutes } from "./products.routes";
import { pricingRoutes } from "./pricing.routes";
import { purchaseRoutes } from "./purchases.routes";
import { printRoutes } from "./print.routes";
import { quotationRoutes } from "./quotations.routes";
import { reportRoutes } from "./reports.routes";
import { salesInvoiceRoutes } from "./sales-invoices.routes";
import { salesOrderRoutes } from "./sales-orders.routes";
import { salesReturnRoutes } from "./sales-returns.routes";
import { settingsRoutes } from "./settings.routes";
import { supplierRoutes } from "./suppliers.routes";
import { systemRoutes } from "./system.routes";

export const api = Router();

// New modular routes.
api.use(authRoutes);
api.use(systemRoutes);
api.use(adminRoutes);
api.use(customerRoutes);
api.use(inventoryRoutes);
api.use(productRoutes);
api.use(pricingRoutes);
api.use(supplierRoutes);
api.use(quotationRoutes);
api.use(salesOrderRoutes);
api.use(salesInvoiceRoutes);
api.use(purchaseRoutes);
api.use(salesReturnRoutes);
api.use(settingsRoutes);
api.use(reportRoutes);
api.use(printRoutes);
