import { z } from "zod";

const paymentLineSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"]),
  amount: z.number().nonnegative(),
});

const payTowardOrderSchema = z.object({
  salesOrderId: z.string(),
  amount: z.number().positive(),
});

const lineSchema = z.object({
  itemId: z.string(),
  enteredQuantity: z.number().positive(),
  unitType: z.enum(["PRIMARY", "SECONDARY"]),
  unitId: z.string(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(0),
});

export const salesOrderCreateSchema = z
  .object({
    customerId: z.string(),
    documentTaxMode: z.enum(["TAX", "NON_TAX"]),
    lines: z.array(lineSchema).min(1),
    /** Legacy single tender line (used when paymentLines is empty) */
    initialPaymentAmount: z.number().nonnegative().optional().default(0),
    paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"]).optional().default("CASH"),
    /** Multiple tender methods (cash, card, …). Do not include STORE_CREDIT here — use storeCreditAmount. */
    paymentLines: z.array(paymentLineSchema).optional(),
    /** Store credit to apply from this customer's balance (exchange returns, etc.) */
    storeCreditAmount: z.number().nonnegative().optional().default(0),
    /** When true, apply the customer's full store-credit balance at checkout; excess over cart is paid out as cash */
    applyFullStoreCredit: z.boolean().optional().default(false),
    /** Pay down existing open sales orders for this customer before applying tender to the new order */
    payTowardOrders: z.array(payTowardOrderSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const hasLines = data.paymentLines && data.paymentLines.length > 0;
    let cashTotal = 0;
    if (hasLines) {
      for (const pl of data.paymentLines!) {
        cashTotal += pl.amount;
      }
    } else {
      cashTotal = data.initialPaymentAmount ?? 0;
    }
    const total = cashTotal + (data.storeCreditAmount ?? 0);
    if (total < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid payment totals" });
    }
  });

export type SalesOrderCreateInput = z.infer<typeof salesOrderCreateSchema>;
