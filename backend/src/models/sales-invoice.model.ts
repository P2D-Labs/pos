import { z } from "zod";
import { listQuerySchema } from "./common.model";

export const salesInvoiceListQuerySchema = listQuerySchema.extend({
  customerId: z.string().optional(),
  /** Only invoices with balance due > 0 */
  openOnly: z.coerce.boolean().optional(),
});

export type SalesInvoiceListQuery = z.infer<typeof salesInvoiceListQuerySchema>;

export const salesInvoiceCreateSchema = z.object({
  customerId: z.string(),
  documentTaxMode: z.enum(["TAX", "NON_TAX"]),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        enteredQuantity: z.number().positive(),
        unitType: z.enum(["PRIMARY", "SECONDARY"]),
        unitId: z.string(),
        unitPrice: z.number().nonnegative(),
        discountAmount: z.number().nonnegative().default(0),
        taxRate: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
  amountReceived: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"]).optional().default("CASH"),
});

export type SalesInvoiceCreateInput = z.infer<typeof salesInvoiceCreateSchema>;
