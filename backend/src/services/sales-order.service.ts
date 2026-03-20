import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import { listQuerySchema } from "../models/common.model";
import type { SalesOrderCreateInput } from "../models/sales-order.model";
import { toPrimaryQuantity } from "./stock.service";

export async function listSalesOrders(
  auth: AuthUser,
  documentTaxMode: "TAX" | "NON_TAX" | undefined,
  query: unknown,
) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  if (documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "view");
  return prisma.salesOrder.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: documentTaxMode ?? (canViewNonTax ? undefined : "TAX"),
      OR: list.search
        ? [
            { orderNo: { contains: list.search, mode: "insensitive" } },
            { customerId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createSalesOrder(auth: AuthUser, input: SalesOrderCreateInput) {
  if (input.documentTaxMode === "NON_TAX") {
    enforceNonTaxPermission(auth, "create");
  }
  const business = await prisma.business.findUniqueOrThrow({ where: { id: auth.businessId } });
  const orderSeries = input.documentTaxMode === "TAX" ? business.taxOrderPrefix : business.nonTaxOrderPrefix;
  const count = await prisma.salesOrder.count({
    where: { businessId: auth.businessId, orderSeries },
  });
  const orderNo = `${orderSeries}-${count + 1}`;

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({ where: { businessId: auth.businessId, id: { in: itemIds } } });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  const lines = input.lines.map((line) => {
    const item = itemMap.get(line.itemId)!;
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    const itemTaxRate = input.documentTaxMode === "NON_TAX" || !item.taxable ? 0 : line.taxRate;
    const preTax = line.enteredQuantity * line.unitPrice - line.discountAmount;
    const lineTax = (preTax * itemTaxRate) / 100;
    const lineTotal = preTax + lineTax;
    subtotal += preTax;
    taxAmount += lineTax;
    discountAmount += line.discountAmount;
    return { line, item, quantityPrimary, itemTaxRate, lineTax, lineTotal };
  });

  return prisma.$transaction(async (tx) => {
    const record = await tx.salesOrder.create({
      data: {
        businessId: auth.businessId,
        orderNo,
        orderSeries,
        documentTaxMode: input.documentTaxMode,
        customerId: input.customerId,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal: subtotal + taxAmount,
        createdBy: auth.sub,
      },
    });
    for (const row of lines) {
      await tx.salesOrderLine.create({
        data: {
          salesOrderId: record.id,
          itemId: row.item.id,
          enteredQuantity: row.line.enteredQuantity,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          conversionFactor: row.line.unitType === "SECONDARY" ? row.item.secondaryToPrimaryFactor : null,
          quantityPrimary: row.quantityPrimary,
          unitPrice: row.line.unitPrice,
          priceSource: "MANUAL",
          discountAmount: row.line.discountAmount,
          taxRate: row.itemTaxRate,
          taxAmount: row.lineTax,
          lineTotal: row.lineTotal,
        },
      });
    }
    return record;
  });
}
