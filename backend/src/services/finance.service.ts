import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { listQuerySchema } from "../models/common.model";

export async function createPayment(
  auth: AuthUser,
  input: {
    referenceType: string;
    referenceId: string;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "WALLET" | "CHEQUE";
    amount: number;
    referenceNo?: string;
    note?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: { businessId: auth.businessId, ...input, createdBy: auth.sub },
    });
    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "CASH",
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: input.note ?? "Payment received",
      },
    });
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

export async function createExpense(
  auth: AuthUser,
  input: {
    category: string;
    paidTo?: string;
    amount: number;
    paymentMethod: string;
    note?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { businessId: auth.businessId, ...input, createdBy: auth.sub },
    });
    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "EXPENSE",
        referenceType: "EXPENSE",
        referenceId: expense.id,
        debitAmount: input.amount,
        creditAmount: 0,
        narration: input.note ?? null,
      },
    });
    return expense;
  });
}

export async function listExpenses(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.expense.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { category: { contains: list.search, mode: "insensitive" } },
            { paidTo: { contains: list.search, mode: "insensitive" } },
            { paymentMethod: { contains: list.search, mode: "insensitive" } },
            { note: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}
