import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import type { CustomerInvoicePaymentBatchInput } from "../models/finance.model";
import { listQuerySchema } from "../models/common.model";

export async function createPayment(
  auth: AuthUser,
  input: {
    referenceType: string;
    referenceId: string;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "WALLET" | "CHEQUE" | "STORE_CREDIT";
    amount: number;
    referenceNo?: string;
    note?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    let salesOrderBefore: { id: string; paid: number; total: number; customerId: string } | null = null;
    if (input.referenceType === "SALES_ORDER") {
      const order = await tx.salesOrder.findFirst({
        where: { id: input.referenceId, businessId: auth.businessId },
      });
      if (!order) throw new HttpError(404, "Sales order not found");
      const paid = Number(order.amountPaid);
      const total = Number(order.grandTotal);
      if (paid + input.amount > total + 0.0001) {
        throw new HttpError(400, "Payment exceeds remaining balance on this order");
      }
      if (input.method === "STORE_CREDIT") {
        const cust = await tx.customer.findFirst({
          where: { id: order.customerId, businessId: auth.businessId },
        });
        if (!cust) throw new HttpError(404, "Customer not found");
        if (Number(cust.storeCreditBalance) + 0.0001 < input.amount) {
          throw new HttpError(400, "Store credit exceeds available balance");
        }
        await tx.customer.update({
          where: { id: cust.id },
          data: { storeCreditBalance: { decrement: input.amount } },
        });
      }
      salesOrderBefore = { id: order.id, paid, total, customerId: order.customerId };
    }

    const payment = await tx.payment.create({
      data: { businessId: auth.businessId, ...input, createdBy: auth.sub },
    });
    const isStoreCredit = input.method === "STORE_CREDIT";
    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: isStoreCredit ? "CUSTOMER_CREDIT" : "CASH",
        accountId: isStoreCredit && salesOrderBefore ? salesOrderBefore.customerId : null,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: input.note ?? (isStoreCredit ? "Store credit payment" : "Payment received"),
      },
    });

    if (salesOrderBefore) {
      const newPaid = salesOrderBefore.paid + input.amount;
      await tx.salesOrder.update({
        where: { id: salesOrderBefore.id },
        data: {
          amountPaid: newPaid,
          balanceDue: Math.max(salesOrderBefore.total - newPaid, 0),
        },
      });
      await tx.customer.update({
        where: { id: salesOrderBefore.customerId },
        data: { currentBalance: { decrement: input.amount } },
      });
    }

    return payment;
  });
}

export async function listPayments(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.payment.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { referenceType: { contains: list.search, mode: "insensitive" } },
            { referenceId: { contains: list.search, mode: "insensitive" } },
            { referenceNo: { contains: list.search, mode: "insensitive" } },
            { note: { contains: list.search, mode: "insensitive" } },
            { checkoutBatchId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createRefund(
  auth: AuthUser,
  input: {
    referenceType: string;
    referenceId: string;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "WALLET";
    amount: number;
    referenceNo?: string;
    note?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: { businessId: auth.businessId, ...input, createdBy: auth.sub },
    });
    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "REFUND",
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: input.note ?? "Refund issued",
      },
    });
    return refund;
  });
}

export async function listRefunds(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.refund.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { referenceType: { contains: list.search, mode: "insensitive" } },
            { referenceId: { contains: list.search, mode: "insensitive" } },
            { referenceNo: { contains: list.search, mode: "insensitive" } },
            { note: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

const EPS = 0.0001;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Customer pays a lump sum, allocated across open invoices. Any excess (change) is not stored as credit.
 */
export async function createCustomerInvoicePaymentBatch(auth: AuthUser, input: CustomerInvoicePaymentBatchInput) {
  const totalAllocated = input.allocations.reduce((s, a) => s + a.amount, 0);
  if (input.amountTendered + EPS < totalAllocated) {
    throw new HttpError(400, "Amount tendered is less than the sum allocated to invoices");
  }
  const invIds = input.allocations.map((a) => a.salesInvoiceId);
  if (new Set(invIds).size !== invIds.length) {
    throw new HttpError(400, "Each invoice may only appear once in allocations");
  }

  const batchId = randomUUID();
  const change = Math.max(0, input.amountTendered - totalAllocated);

  return prisma.$transaction(async (tx) => {
    const cust = await tx.customer.findFirst({
      where: { id: input.customerId, businessId: auth.businessId },
    });
    if (!cust) throw new HttpError(404, "Customer not found");

    if (input.method === "STORE_CREDIT") {
      if (Number(cust.storeCreditBalance) + EPS < totalAllocated) {
        throw new HttpError(400, "Store credit is insufficient for this allocation");
      }
      await tx.customer.update({
        where: { id: cust.id },
        data: { storeCreditBalance: { decrement: totalAllocated } },
      });
    }

    const baseNote =
      change > EPS
        ? `${input.note ?? "Invoice payment"} — tendered ${input.amountTendered.toFixed(2)}, change ${change.toFixed(2)}`
        : input.note ?? "Invoice payment";

    const created: string[] = [];

    for (let i = 0; i < input.allocations.length; i++) {
      const al = input.allocations[i];
      const inv = await tx.salesInvoice.findFirst({
        where: { id: al.salesInvoiceId, businessId: auth.businessId, customerId: input.customerId },
      });
      if (!inv) throw new HttpError(404, "Invoice not found for this customer");
      const balanceDue = Number(inv.balanceDue);
      if (al.amount - balanceDue > EPS) {
        throw new HttpError(400, `Payment exceeds balance due on invoice ${inv.invoiceNo}`);
      }

      const newReceived = Number(inv.amountReceived) + al.amount;
      const newBalanceDue = Math.max(Number(inv.grandTotal) - newReceived, 0);

      await tx.salesInvoice.update({
        where: { id: inv.id },
        data: { amountReceived: newReceived, balanceDue: newBalanceDue },
      });

      const payment = await tx.payment.create({
        data: {
          businessId: auth.businessId,
          referenceType: "SALES_INVOICE",
          referenceId: inv.id,
          method: input.method,
          amount: al.amount,
          checkoutBatchId: batchId,
          note: i === 0 ? baseNote : undefined,
          createdBy: auth.sub,
        },
      });
      created.push(payment.id);

      const isStoreCredit = input.method === "STORE_CREDIT";
      await tx.ledgerEntry.create({
        data: {
          businessId: auth.businessId,
          accountType: isStoreCredit ? "CUSTOMER_CREDIT" : "CASH",
          accountId: isStoreCredit ? input.customerId : null,
          referenceType: "PAYMENT_RECEIVED",
          referenceId: inv.id,
          debitAmount: al.amount,
          creditAmount: 0,
          narration: `Payment for invoice ${inv.invoiceNo}`,
        },
      });

      const salesEntry = await tx.ledgerEntry.findFirst({
        where: {
          businessId: auth.businessId,
          referenceType: "SALES_INVOICE",
          referenceId: inv.id,
          accountType: "SALES",
        },
      });
      if (salesEntry) {
        const nextDebit = Math.max(0, Number(salesEntry.debitAmount) - al.amount);
        await tx.ledgerEntry.update({
          where: { id: salesEntry.id },
          data: { debitAmount: nextDebit },
        });
      }

      /** Keep paired Till/POS sales order in sync with the invoice. */
      if (inv.salesOrderId) {
        const order = await tx.salesOrder.findFirst({
          where: { id: inv.salesOrderId, businessId: auth.businessId, customerId: input.customerId },
        });
        if (order) {
          const oTotal = Number(order.grandTotal);
          const newOrderPaid = round2(Number(order.amountPaid) + al.amount);
          if (newOrderPaid - oTotal > EPS) {
            throw new HttpError(400, "Payment would exceed the linked sales order total");
          }
          await tx.salesOrder.update({
            where: { id: order.id },
            data: {
              amountPaid: newOrderPaid,
              balanceDue: round2(Math.max(oTotal - newOrderPaid, 0)),
            },
          });
          await tx.customer.update({
            where: { id: input.customerId },
            data: { currentBalance: { decrement: al.amount } },
          });
        }
      }
    }

    return {
      checkoutBatchId: batchId,
      paymentIds: created,
      totalAllocated,
      amountTendered: input.amountTendered,
      changeAmount: change,
    };
  });
}

