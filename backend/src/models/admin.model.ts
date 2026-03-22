import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export const roleUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const userSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  roleId: z.string(),
});

export const userUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  roleId: z.string().optional(),
});

export const unitSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimalPrecision: z.number().int().min(0).max(6).default(0),
});

export const nameSchema = z.object({
  name: z.string().min(2),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  subcategories: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    )
    .optional(),
});

export const subCategorySchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().optional(),
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
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE", "STORE_CREDIT"]),
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

