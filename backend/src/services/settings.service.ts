import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";

export async function updateBusinessSettings(auth: AuthUser, input: Record<string, unknown>) {
  return prisma.business.update({
    where: { id: auth.businessId },
    data: input,
  });
}

export async function updateCustomizationSettings(auth: AuthUser, input: {
  invoiceTemplate?: unknown;
  nonTaxTemplate?: unknown;
  themeConfig?: unknown;
  moduleToggles?: unknown;
  paymentMethods?: string[];
  allowedDiscount?: number;
  productFieldConfig?: unknown;
  customerFieldConfig?: unknown;
  supplierFieldConfig?: unknown;
}) {
  const settingsPayload = {
    invoiceTemplate: input.invoiceTemplate as Prisma.InputJsonValue | undefined,
    nonTaxTemplate: input.nonTaxTemplate as Prisma.InputJsonValue | undefined,
    themeConfig: input.themeConfig as Prisma.InputJsonValue | undefined,
    moduleToggles: input.moduleToggles as Prisma.InputJsonValue | undefined,
    paymentMethods: input.paymentMethods,
    allowedDiscount: input.allowedDiscount,
    productFieldConfig: input.productFieldConfig as Prisma.InputJsonValue | undefined,
    customerFieldConfig: input.customerFieldConfig as Prisma.InputJsonValue | undefined,
    supplierFieldConfig: input.supplierFieldConfig as Prisma.InputJsonValue | undefined,
  };

  return prisma.businessSettings.upsert({
    where: { id: `${auth.businessId}-settings` },
    update: { ...settingsPayload, updatedBy: auth.sub },
    create: {
      id: `${auth.businessId}-settings`,
      businessId: auth.businessId,
      ...settingsPayload,
      updatedBy: auth.sub,
    },
  });
}

export async function getCustomizationSettings(auth: AuthUser) {
  return prisma.businessSettings.findUnique({
    where: { id: `${auth.businessId}-settings` },
  });
}
