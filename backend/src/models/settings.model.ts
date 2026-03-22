import { z } from "zod";

export const businessSettingsUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  ownerName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxRegistrationNo: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  financialYearStart: z.string().optional(),
  logoUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export const customizationSettingsSchema = z.object({
  invoiceTemplate: z.unknown().optional(),
  nonTaxTemplate: z.unknown().optional(),
  themeConfig: z.unknown().optional(),
  moduleToggles: z.unknown().optional(),
  paymentMethods: z.array(z.string()).optional(),
  allowedDiscount: z.number().nonnegative().optional(),
  productFieldConfig: z.unknown().optional(),
  customerFieldConfig: z.unknown().optional(),
  supplierFieldConfig: z.unknown().optional(),
  quotationDisclaimer: z.string().optional(),
  returnDisclaimer: z.string().optional(),
});
