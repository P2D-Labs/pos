import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import { listQuerySchema } from "../models/common.model";

function getPageParams(query: unknown) {
  const input = listQuerySchema.parse(query);
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
    search: input.search,
  };
}

function buildLast7DaysSalesTrend(rows: { invoiceDate: Date; grandTotal: unknown }[]) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.invoiceDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(row.grandTotal));
  }
  const out: Array<{ date: string; total: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, total: byDay.get(key) ?? 0 });
  }
  return out;
}

export async function getDashboardReport(auth: AuthUser) {
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  const invoiceModeFilter = canViewNonTax ? {} : ({ documentTaxMode: "TAX" as const });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const [
    business,
    customers,
    suppliers,
    items,
    invoices,
    expenses,
    lowStockCandidates,
    receivableAgg,
    payableAgg,
    trendRows,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { name: true, currency: true },
    }),
    prisma.customer.count({ where: { businessId: auth.businessId } }),
    prisma.supplier.count({ where: { businessId: auth.businessId } }),
    prisma.item.count({ where: { businessId: auth.businessId } }),
    prisma.salesInvoice.findMany({
      where: {
        businessId: auth.businessId,
        ...invoiceModeFilter,
      },
    }),
    prisma.expense.findMany({ where: { businessId: auth.businessId } }),
    prisma.item.findMany({
      where: { businessId: auth.businessId, reorderLevelPrimary: { not: null } },
      select: {
        id: true,
        name: true,
        currentStockPrimary: true,
        reorderLevelPrimary: true,
      },
    }),
    prisma.salesInvoice.aggregate({
      where: {
        businessId: auth.businessId,
        balanceDue: { gt: 0 },
        ...invoiceModeFilter,
      },
      _sum: { balanceDue: true },
    }),
    prisma.purchase.aggregate({
      where: {
        businessId: auth.businessId,
        balancePayable: { gt: 0 },
      },
      _sum: { balancePayable: true },
    }),
    prisma.salesInvoice.findMany({
      where: {
        businessId: auth.businessId,
        invoiceDate: { gte: sevenDaysAgo },
        ...invoiceModeFilter,
      },
      select: { invoiceDate: true, grandTotal: true },
    }),
  ]);

  const lowStockItems = lowStockCandidates.filter(
    (row) => Number(row.currentStockPrimary) <= Number(row.reorderLevelPrimary ?? 0),
  );

  return {
    business: { name: business?.name ?? "", currency: business?.currency ?? "LKR" },
    customers,
    suppliers,
    items,
    invoices: invoices.length,
    salesTotal: invoices.reduce((sum, row) => sum + Number(row.grandTotal), 0),
    expenseTotal: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    lowStockCount: lowStockItems.length,
    lowStockPreview: lowStockItems.slice(0, 5).map((row) => ({
      id: row.id,
      name: row.name,
      currentStockPrimary: row.currentStockPrimary,
      reorderLevelPrimary: row.reorderLevelPrimary,
    })),
    outstandingReceivables: Number(receivableAgg._sum.balanceDue ?? 0),
    outstandingPayables: Number(payableAgg._sum.balancePayable ?? 0),
    salesTrend: buildLast7DaysSalesTrend(trendRows),
  };
}

export async function getTaxSalesReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: "TAX",
      OR: search
        ? [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { customerId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getNonTaxSalesReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  enforceNonTaxPermission(auth, "view");
  return prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: "NON_TAX",
      OR: search
        ? [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { customerId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getStockSummaryReport(auth: AuthUser) {
  return prisma.item.findMany({
    where: { businessId: auth.businessId },
    select: { id: true, name: true, currentStockPrimary: true, reorderLevelPrimary: true },
    orderBy: { name: "asc" },
  });
}

export async function getLowStockReport(auth: AuthUser) {
  const items = await prisma.item.findMany({
    where: { businessId: auth.businessId, reorderLevelPrimary: { not: null } },
    orderBy: { name: "asc" },
  });
  return items.filter((item) => Number(item.currentStockPrimary) <= Number(item.reorderLevelPrimary ?? 0));
}

export async function getReceivablesReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  return prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      balanceDue: { gt: 0 },
      documentTaxMode: canViewNonTax ? undefined : "TAX",
      OR: search
        ? [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { customerId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getPayablesReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.purchase.findMany({
    where: {
      businessId: auth.businessId,
      balancePayable: { gt: 0 },
      OR: search
        ? [
            { purchaseNo: { contains: search, mode: "insensitive" } },
            { supplierId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getSalesReturnsReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.salesReturn.findMany({
    where: {
      businessId: auth.businessId,
      OR: search
        ? [
            { salesReturnNo: { contains: search, mode: "insensitive" } },
            { customerId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getRefundsReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.refund.findMany({
    where: {
      businessId: auth.businessId,
      OR: search
        ? [
            { referenceType: { contains: search, mode: "insensitive" } },
            { referenceId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getExpensesReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.expense.findMany({
    where: {
      businessId: auth.businessId,
      OR: search
        ? [
            { category: { contains: search, mode: "insensitive" } },
            { paidTo: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getAuditReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.auditLog.findMany({
    where: {
      businessId: auth.businessId,
      OR: search
        ? [
            { action: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
            { entityId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getSalesByItemReport(auth: AuthUser) {
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  const lines = await prisma.salesInvoiceLine.findMany({ orderBy: { id: "desc" } });
  const scopedInvoices = await prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: canViewNonTax ? undefined : "TAX",
    },
    select: { id: true },
  });
  const invoiceSet = new Set(scopedInvoices.map((row) => row.id));
  const scopedLines = lines.filter((line) => invoiceSet.has(line.salesInvoiceId));
  const summary = new Map<string, { itemId: string; quantityPrimary: number; salesAmount: number; taxAmount: number }>();
  for (const line of scopedLines) {
    const prev = summary.get(line.itemId) ?? { itemId: line.itemId, quantityPrimary: 0, salesAmount: 0, taxAmount: 0 };
    prev.quantityPrimary += Number(line.quantityPrimary);
    prev.salesAmount += Number(line.lineTotal);
    prev.taxAmount += Number(line.taxAmount);
    summary.set(line.itemId, prev);
  }
  return Array.from(summary.values());
}

export async function getSalesByCustomerReport(auth: AuthUser) {
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: canViewNonTax ? undefined : "TAX",
    },
    orderBy: { createdAt: "desc" },
  });
  const summary = new Map<string, { customerId: string; invoices: number; grandTotal: number; balanceDue: number }>();
  for (const invoice of invoices) {
    const prev = summary.get(invoice.customerId) ?? { customerId: invoice.customerId, invoices: 0, grandTotal: 0, balanceDue: 0 };
    prev.invoices += 1;
    prev.grandTotal += Number(invoice.grandTotal);
    prev.balanceDue += Number(invoice.balanceDue);
    summary.set(invoice.customerId, prev);
  }
  return Array.from(summary.values());
}

export async function getPurchasesBySupplierReport(auth: AuthUser) {
  const purchases = await prisma.purchase.findMany({
    where: { businessId: auth.businessId },
    orderBy: { createdAt: "desc" },
  });
  const summary = new Map<string, { supplierId: string; purchases: number; grandTotal: number; balancePayable: number }>();
  for (const purchase of purchases) {
    const prev = summary.get(purchase.supplierId) ?? { supplierId: purchase.supplierId, purchases: 0, grandTotal: 0, balancePayable: 0 };
    prev.purchases += 1;
    prev.grandTotal += Number(purchase.grandTotal);
    prev.balancePayable += Number(purchase.balancePayable);
    summary.set(purchase.supplierId, prev);
  }
  return Array.from(summary.values());
}

export async function getStockMovementReport(auth: AuthUser, query: unknown) {
  const { skip, take, search } = getPageParams(query);
  return prisma.stockTransaction.findMany({
    where: {
      businessId: auth.businessId,
      OR: search
        ? [
            { itemId: { contains: search, mode: "insensitive" } },
            { referenceType: { contains: search, mode: "insensitive" } },
            { referenceId: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { transactionDate: "desc" },
    skip,
    take,
  });
}

export async function getQuotationConversionReport(auth: AuthUser) {
  const quotationCount = await prisma.quotation.count({
    where: { businessId: auth.businessId },
  });
  const convertedCount = await prisma.auditLog.count({
    where: { businessId: auth.businessId, action: "QUOTATION_CONVERT_TO_INVOICE" },
  });
  return {
    quotationCount,
    convertedCount,
    conversionRate: quotationCount === 0 ? 0 : (convertedCount / quotationCount) * 100,
  };
}

export async function getUserActivityReport(auth: AuthUser, query: unknown) {
  const { skip, take } = getPageParams(query);
  const rows = await prisma.auditLog.findMany({
    where: { businessId: auth.businessId },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  const summary = new Map<string, { userId: string; actions: number; lastActivityAt: string }>();
  for (const log of rows) {
    const prev = summary.get(log.userId) ?? { userId: log.userId, actions: 0, lastActivityAt: log.createdAt.toISOString() };
    prev.actions += 1;
    if (log.createdAt.toISOString() > prev.lastActivityAt) prev.lastActivityAt = log.createdAt.toISOString();
    summary.set(log.userId, prev);
  }
  return Array.from(summary.values());
}

export async function getDailySalesReport(auth: AuthUser, query: unknown) {
  const { skip, take } = getPageParams(query);
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: canViewNonTax ? undefined : "TAX",
    },
    orderBy: { invoiceDate: "desc" },
    skip,
    take,
  });
  const summary = new Map<string, { date: string; invoices: number; amount: number }>();
  for (const invoice of invoices) {
    const date = invoice.invoiceDate.toISOString().slice(0, 10);
    const prev = summary.get(date) ?? { date, invoices: 0, amount: 0 };
    prev.invoices += 1;
    prev.amount += Number(invoice.grandTotal);
    summary.set(date, prev);
  }
  return Array.from(summary.values());
}

export async function getProfitSummaryReport(auth: AuthUser) {
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: canViewNonTax ? undefined : "TAX",
    },
  });
  const purchaseLines = await prisma.purchaseLine.findMany({
    where: {
      purchaseId: {
        in: (
          await prisma.purchase.findMany({
            where: { businessId: auth.businessId },
            select: { id: true },
          })
        ).map((row) => row.id),
      },
    },
  });

  const sales = invoices.reduce((sum, row) => sum + Number(row.grandTotal), 0);
  const purchaseCost = purchaseLines.reduce((sum, row) => sum + Number(row.lineTotal), 0);
  return {
    totalSales: sales,
    totalPurchaseCost: purchaseCost,
    grossProfitEstimate: sales - purchaseCost,
  };
}
