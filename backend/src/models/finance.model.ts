import { z } from "zod";

export const customerInvoicePaymentBatchSchema = z.object({
  customerId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE", "STORE_CREDIT"]),
  /** Cash/card tendered (or total applied when using store credit only). Must be ≥ sum(allocations). Excess is change, not stored. */
  amountTendered: z.number().nonnegative(),
  allocations: z
    .array(
      z.object({
        salesInvoiceId: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1),
  note: z.string().optional(),
});

export type CustomerInvoicePaymentBatchInput = z.infer<typeof customerInvoicePaymentBatchSchema>;
