import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export const userSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  roleId: z.string(),
});

export const unitSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimalPrecision: z.number().int().min(0).max(6).default(0),
});

export const nameSchema = z.object({
  name: z.string().min(2),
});

export const taxRateSchema = z.object({
  name: z.string().min(2),
  ratePercent: z.number().nonnegative(),
  code: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const numberingSchema = z.object({
  taxInvoicePrefix: z.string().min(1),
  nonTaxInvoicePrefix: z.string().min(1),
  taxOrderPrefix: z.string().min(1),
  nonTaxOrderPrefix: z.string().min(1),
  quotationPrefix: z.string().min(1),
  purchasePrefix: z.string().min(1),
  salesReturnPrefix: z.string().min(1),
});

export const paymentSchema = z.object({
  referenceType: z.string().min(2),
  referenceId: z.string().min(2),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"]),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  note: z.string().optional(),
});

export const refundSchema = z.object({
  referenceType: z.string().min(2),
  referenceId: z.string().min(2),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET"]),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  note: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.string().min(2),
  paidTo: z.string().optional(),
  amount: z.number().positive(),
  paymentMethod: z.string().min(2),
  note: z.string().optional(),
});
