import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import { listQuerySchema } from "../models/common.model";
import type { SalesOrderCreateInput } from "../models/sales-order.model";
import { createSalesInvoiceForOrderInTx } from "./sales-invoice.service";
import { itemTracksInventory, toPrimaryQuantity, validateDocumentLineUnits } from "./stock.service";

const MONEY_EPS = 0.005;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type MethodAmount = { method: PaymentMethod; amount: number };

function mergePayTowardOrders(rows: Array<{ salesOrderId: string; amount: number }>) {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.salesOrderId, round2((map.get(r.salesOrderId) ?? 0) + r.amount));
  }
  return [...map.entries()].map(([salesOrderId, amount]) => ({ salesOrderId, amount }));
}

function normalizePaymentInput(input: SalesOrderCreateInput): {
  lines: SalesOrderCreateInput["lines"];
  tenderPool: MethodAmount[];
  storeCreditAmount: number;
  payTowardOrders: Array<{ salesOrderId: string; amount: number }>;
} {
  const storeCreditAmount = round2(input.storeCreditAmount ?? 0);
  const payTowardOrders = mergePayTowardOrders(input.payTowardOrders ?? []);
  const tenderPool: MethodAmount[] = [];

  if (input.paymentLines && input.paymentLines.length > 0) {
    for (const pl of input.paymentLines) {
      if (pl.amount > MONEY_EPS) tenderPool.push({ method: pl.method as PaymentMethod, amount: round2(pl.amount) });
    }
  } else {
    const amt = round2(input.initialPaymentAmount ?? 0);
    if (amt > MONEY_EPS) tenderPool.push({ method: (input.paymentMethod ?? "CASH") as PaymentMethod, amount: amt });
  }

  if (storeCreditAmount > MONEY_EPS) {
    tenderPool.push({ method: "STORE_CREDIT", amount: storeCreditAmount });
  }

  return { lines: input.lines, tenderPool, storeCreditAmount, payTowardOrders };
}

/** Split chunk across tender pool (cash + card + … + store credit) proportionally */
function splitProportionally(chunk: number, pool: MethodAmount[]): MethodAmount[] {
  const total = pool.reduce((s, p) => s + p.amount, 0);
  if (chunk <= MONEY_EPS || total <= MONEY_EPS) return [];
  const target = round2(chunk);
  const out: MethodAmount[] = [];
  let allocated = 0;
  for (let i = 0; i < pool.length; i++) {
    const portion =
      i === pool.length - 1 ? round2(target - allocated) : round2((target * pool[i].amount) / total);
    if (portion > MONEY_EPS) {
      out.push({ method: pool[i].method, amount: portion });
      allocated = round2(allocated + portion);
    }
  }
  return out;
}

async function recordPaymentsForOrder(
  tx: Prisma.TransactionClient,
  auth: AuthUser,
  params: {
    referenceType: string;
    referenceId: string;
    orderLabel: string;
    parts: MethodAmount[];
    checkoutBatchId: string;
    customerId: string;
  },
) {
  const { businessId, sub } = auth;
  for (const part of params.parts) {
    if (part.amount <= MONEY_EPS) continue;
    await tx.payment.create({
      data: {
        businessId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        method: part.method,
        amount: part.amount,
        checkoutBatchId: params.checkoutBatchId,
        note: `Checkout batch ${params.checkoutBatchId}`,
        createdBy: sub,
      },
    });
    const isStoreCredit = part.method === "STORE_CREDIT";
    await tx.ledgerEntry.create({
      data: {
        businessId,
        accountType: isStoreCredit ? "CUSTOMER_CREDIT" : "CASH",
        accountId: isStoreCredit ? params.customerId : null,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        debitAmount: part.amount,
        creditAmount: 0,
        narration: `${isStoreCredit ? "Store credit" : "Payment"} — ${params.orderLabel}`,
      },
    });
  }
}

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
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, businessId: auth.businessId },
  });
  if (!customer) throw new HttpError(404, "Customer not found");

  const isWalkIn = customer.customerType === "WALK_IN";
  const fullAvail = round2(Number(customer.storeCreditBalance ?? 0));

  if (isWalkIn && input.applyFullStoreCredit) {
    throw new HttpError(400, "Walk-in checkout cannot use return credit");
  }

  const effectiveInput: SalesOrderCreateInput =
    input.applyFullStoreCredit && !isWalkIn ? { ...input, storeCreditAmount: fullAvail } : input;

  const { tenderPool, storeCreditAmount, payTowardOrders } = normalizePaymentInput(effectiveInput);
  const cashLikeTotal = tenderPool.filter((p) => p.method !== "STORE_CREDIT").reduce((s, p) => s + p.amount, 0);
  const totalTender = round2(tenderPool.reduce((s, p) => s + p.amount, 0));

  if (isWalkIn) {
    if (payTowardOrders.length > 0) {
      throw new HttpError(400, "Walk-in checkout cannot allocate tender to previous orders");
    }
    if (storeCreditAmount > MONEY_EPS) {
      throw new HttpError(400, "Walk-in checkout cannot use store credit");
    }
  }

  if (storeCreditAmount > MONEY_EPS) {
    const available = Number(customer.storeCreditBalance ?? 0);
    if (storeCreditAmount > available + MONEY_EPS) {
      throw new HttpError(400, "Store credit exceeds available balance");
    }
  }

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
    const item = itemMap.get(line.itemId);
    if (!item) throw new HttpError(400, `Unknown item ${line.itemId}`);
    validateDocumentLineUnits(item, line, "SALES");
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    if (
      itemTracksInventory(item) &&
      !item.allowNegativeStock &&
      Number(item.currentStockPrimary) < quantityPrimary
    ) {
      throw new HttpError(400, `Insufficient stock for item ${item.name}`);
    }
    const itemTaxRate = input.documentTaxMode === "NON_TAX" || !item.taxable ? 0 : line.taxRate;
    const preTax = line.enteredQuantity * line.unitPrice - line.discountAmount;
    const lineTax = (preTax * itemTaxRate) / 100;
    const lineTotal = preTax + lineTax;
    subtotal += preTax;
    taxAmount += lineTax;
    discountAmount += line.discountAmount;
    return { line, item, quantityPrimary, itemTaxRate, lineTax, lineTotal };
  });

  const grandTotal = round2(subtotal + taxAmount);

  const sumPriorRequested = round2(payTowardOrders.reduce((s, p) => s + p.amount, 0));
  if (sumPriorRequested > totalTender + MONEY_EPS) {
    throw new HttpError(400, "Amount allocated to existing orders exceeds total tender");
  }

  if (tenderPool.length === 0 && sumPriorRequested > MONEY_EPS) {
    throw new HttpError(400, "Cannot allocate to existing orders without tender");
  }

  if (payTowardOrders.length > 0) {
    const ids = [...new Set(payTowardOrders.map((p) => p.salesOrderId))];
    const orders = await prisma.salesOrder.findMany({
      where: { businessId: auth.businessId, customerId: input.customerId, id: { in: ids } },
    });
    const oMap = new Map(orders.map((o) => [o.id, o]));
    for (const alloc of payTowardOrders) {
      const o = oMap.get(alloc.salesOrderId);
      if (!o) throw new HttpError(404, `Sales order ${alloc.salesOrderId} not found for this customer`);
      const due = round2(Number(o.balanceDue));
      if (alloc.amount > due + MONEY_EPS) {
        throw new HttpError(400, `Payment for ${o.orderNo} exceeds balance due`);
      }
    }
  }

  const remainingAfterPrior = round2(totalTender - sumPriorRequested);
  const appliedToNew = round2(Math.min(remainingAfterPrior, grandTotal));
  const newBalanceDue = round2(Math.max(grandTotal - appliedToNew, 0));

  if (isWalkIn && newBalanceDue > MONEY_EPS) {
    throw new HttpError(400, "Walk-in sales must be paid in full at checkout");
  }

  const checkoutBatchId = `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const applyFullStoreCredit = Boolean(input.applyFullStoreCredit && !isWalkIn && fullAvail > MONEY_EPS);

  return prisma.$transaction(async (tx) => {
    for (const alloc of payTowardOrders) {
      const orderRow = await tx.salesOrder.findFirst({
        where: { id: alloc.salesOrderId, businessId: auth.businessId },
      });
      if (!orderRow) throw new HttpError(404, "Order not found");
      const payAmt = round2(alloc.amount);
      const paidBefore = Number(orderRow.amountPaid);
      const total = Number(orderRow.grandTotal);
      if (paidBefore + payAmt > total + MONEY_EPS) {
        throw new HttpError(400, "Payment exceeds remaining balance on an existing order");
      }
      const parts = splitProportionally(payAmt, tenderPool);
      await recordPaymentsForOrder(tx, auth, {
        referenceType: "SALES_ORDER",
        referenceId: orderRow.id,
        orderLabel: orderRow.orderNo,
        parts,
        checkoutBatchId,
        customerId: input.customerId,
      });
      const newPaid = round2(paidBefore + payAmt);
      await tx.salesOrder.update({
        where: { id: orderRow.id },
        data: {
          amountPaid: newPaid,
          balanceDue: round2(Math.max(total - newPaid, 0)),
        },
      });
      await tx.customer.update({
        where: { id: input.customerId },
        data: { currentBalance: { decrement: payAmt } },
      });
    }

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
        grandTotal,
        amountPaid: appliedToNew,
        balanceDue: newBalanceDue,
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

    const invoiceSeries = input.documentTaxMode === "TAX" ? business.taxInvoicePrefix : business.nonTaxInvoicePrefix;
    const invoiceSeriesCount = await tx.salesInvoice.count({
      where: { businessId: auth.businessId, invoiceSeries },
    });
    const invoiceNo = `${invoiceSeries}-${invoiceSeriesCount + 1}`;
    const pairedInvoice = await createSalesInvoiceForOrderInTx(tx, auth, {
      salesOrderId: record.id,
      customerId: input.customerId,
      documentTaxMode: input.documentTaxMode,
      invoiceNo,
      invoiceSeries,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      amountReceived: appliedToNew,
      balanceDue: newBalanceDue,
      lines,
    });

    if (appliedToNew > MONEY_EPS) {
      const parts = splitProportionally(appliedToNew, tenderPool);
      await recordPaymentsForOrder(tx, auth, {
        referenceType: "SALES_ORDER",
        referenceId: record.id,
        orderLabel: orderNo,
        parts,
        checkoutBatchId,
        customerId: input.customerId,
      });
    }

    let storeCreditCashPayout = 0;
    if (applyFullStoreCredit) {
      const scPayments = await tx.payment.findMany({
        where: { businessId: auth.businessId, checkoutBatchId, method: "STORE_CREDIT" },
      });
      const scSum = round2(scPayments.reduce((s, p) => s + Number(p.amount), 0));
      const excess = round2(fullAvail - scSum);
      await tx.customer.update({
        where: { id: input.customerId },
        data: { storeCreditBalance: { decrement: fullAvail } },
      });
      if (excess > MONEY_EPS) {
        storeCreditCashPayout = excess;
        await tx.refund.create({
          data: {
            businessId: auth.businessId,
            referenceType: "CHECKOUT_STORE_CREDIT_PAYOUT",
            referenceId: record.id,
            method: "CASH",
            amount: excess,
            note: "Return credit balance paid out at till",
            createdBy: auth.sub,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            businessId: auth.businessId,
            accountType: "REFUND",
            referenceType: "CHECKOUT_STORE_CREDIT_PAYOUT",
            referenceId: record.id,
            debitAmount: excess,
            creditAmount: 0,
            narration: "Return credit excess paid as cash",
          },
        });
      }
    } else if (storeCreditAmount > MONEY_EPS) {
      await tx.customer.update({
        where: { id: input.customerId },
        data: { storeCreditBalance: { decrement: storeCreditAmount } },
      });
    }

    if (newBalanceDue > MONEY_EPS) {
      await tx.customer.update({
        where: { id: input.customerId },
        data: { currentBalance: { increment: newBalanceDue } },
      });
    }

    return {
      ...record,
      salesInvoice: { id: pairedInvoice.id, invoiceNo: pairedInvoice.invoiceNo },
      checkout: {
        checkoutBatchId,
        tenderTotal: totalTender,
        cashAndElectronicTotal: cashLikeTotal,
        storeCreditApplied: storeCreditAmount,
        appliedToPriorOrders: sumPriorRequested,
        appliedToNewOrder: appliedToNew,
        newOrderBalanceDue: newBalanceDue,
        changeOrOverpay: round2(Math.max(remainingAfterPrior - appliedToNew, 0)),
        storeCreditCashPayout,
        classification:
          newBalanceDue <= MONEY_EPS && grandTotal > MONEY_EPS
            ? "PAID_IN_FULL"
            : newBalanceDue > MONEY_EPS
              ? "ON_ACCOUNT"
              : grandTotal <= MONEY_EPS
                ? "ZERO_TOTAL"
                : "NO_PAYMENT",
      },
    };
  });
}
