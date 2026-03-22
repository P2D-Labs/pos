import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { productListQuerySchema, productSchema, productUpdateSchema } from "../models/product.model";
import { HttpError } from "../lib/http";

async function validateItemReferences(
  auth: AuthUser,
  input: {
    categoryId?: string;
    subCategoryId?: string;
    brandId?: string;
    primaryUnitId?: string;
    secondaryUnitId?: string;
    defaultTaxRateId?: string;
  },
) {
  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!category) throw new HttpError(400, "Invalid category for this business");
  }

  if (input.subCategoryId) {
    const subCategory = await prisma.subCategory.findFirst({
      where: { id: input.subCategoryId, businessId: auth.businessId },
      select: { id: true, categoryId: true },
    });
    if (!subCategory) throw new HttpError(400, "Invalid subcategory for this business");
    if (input.categoryId && subCategory.categoryId && subCategory.categoryId !== input.categoryId) {
      throw new HttpError(400, "Subcategory does not belong to the selected category");
    }
  }

  if (input.brandId) {
    const brand = await prisma.brand.findFirst({
      where: { id: input.brandId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!brand) throw new HttpError(400, "Invalid brand for this business");
  }

  if (input.primaryUnitId) {
    const primaryUnit = await prisma.unit.findFirst({
      where: { id: input.primaryUnitId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!primaryUnit) throw new HttpError(400, "Invalid primary unit for this business");
  }

  if (input.secondaryUnitId) {
    const secondaryUnit = await prisma.unit.findFirst({
      where: { id: input.secondaryUnitId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!secondaryUnit) throw new HttpError(400, "Invalid secondary unit for this business");
  }

  if (input.defaultTaxRateId) {
    const taxRate = await prisma.taxRate.findFirst({
      where: { id: input.defaultTaxRateId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!taxRate) throw new HttpError(400, "Invalid default tax rate for this business");
  }
}

function validateUnitConsistency(input: {
  primaryUnitId?: string | null;
  secondaryUnitId?: string | null;
  secondaryToPrimaryFactor?: number | null;
}) {
  if (input.secondaryUnitId) {
    const factor = input.secondaryToPrimaryFactor;
    if (factor == null || factor <= 0) {
      throw new HttpError(400, "Secondary unit requires a positive conversion factor to the primary unit");
    }
    if (input.primaryUnitId && input.secondaryUnitId === input.primaryUnitId) {
      throw new HttpError(400, "Secondary unit must be different from the primary unit");
    }
  }
}

export async function listProducts(auth: AuthUser, query: unknown) {
  const input = productListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  const search = input.search?.trim();
  return prisma.item.findMany({
    where: {
      businessId: auth.businessId,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
              { subCategory: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createProduct(auth: AuthUser, payload: unknown) {
  const input = productSchema.parse(payload);
  await validateItemReferences(auth, input);
  validateUnitConsistency(input);
  const created = await prisma.item.create({
    data: {
      ...input,
      businessId: auth.businessId,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      salesPricePrimary: input.salesPricePrimary,
      purchasePricePrimary: input.purchasePricePrimary,
    },
  });
  await prisma.itemUnitConfig.upsert({
    where: { itemId: created.id },
    update: {
      primaryUnitId: input.primaryUnitId,
      secondaryUnitId: input.secondaryUnitId,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      allowSalesInSecondaryUnit: input.allowSalesInSecondaryUnit,
      allowPurchaseInSecondaryUnit: input.allowPurchaseInSecondaryUnit,
      allowSecondaryFraction: input.allowSecondaryFraction,
    },
    create: {
      businessId: auth.businessId,
      itemId: created.id,
      primaryUnitId: input.primaryUnitId,
      secondaryUnitId: input.secondaryUnitId,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      allowSalesInSecondaryUnit: input.allowSalesInSecondaryUnit,
      allowPurchaseInSecondaryUnit: input.allowPurchaseInSecondaryUnit,
      allowSecondaryFraction: input.allowSecondaryFraction,
    },
  });
  return created;
}

export async function getProductById(auth: AuthUser, itemId: string) {
  const data = await prisma.item.findFirst({ where: { id: itemId, businessId: auth.businessId } });
  if (!data) throw new HttpError(404, "Item not found");
  return data;
}

export async function updateProduct(auth: AuthUser, itemId: string, payload: unknown) {
  const input = productUpdateSchema.parse(payload);
  const existing = await prisma.item.findFirst({ where: { id: itemId, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Item not found");
  await validateItemReferences(auth, {
    categoryId: input.categoryId ?? existing.categoryId ?? undefined,
    subCategoryId: input.subCategoryId ?? existing.subCategoryId ?? undefined,
    brandId: input.brandId ?? existing.brandId ?? undefined,
    primaryUnitId: input.primaryUnitId ?? existing.primaryUnitId ?? undefined,
    secondaryUnitId: input.secondaryUnitId ?? existing.secondaryUnitId ?? undefined,
    defaultTaxRateId: input.defaultTaxRateId ?? existing.defaultTaxRateId ?? undefined,
  });
  validateUnitConsistency({
    primaryUnitId: input.primaryUnitId ?? existing.primaryUnitId,
    secondaryUnitId: input.secondaryUnitId ?? existing.secondaryUnitId,
    secondaryToPrimaryFactor:
      input.secondaryToPrimaryFactor ?? (existing.secondaryToPrimaryFactor != null
        ? Number(existing.secondaryToPrimaryFactor)
        : null),
  });
  const updated = await prisma.item.update({
    where: { id: itemId },
    data: {
      ...input,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      salesPricePrimary: input.salesPricePrimary,
      purchasePricePrimary: input.purchasePricePrimary,
    },
  });
  await prisma.itemUnitConfig.upsert({
    where: { itemId },
    update: {
      ...(input.primaryUnitId !== undefined ? { primaryUnitId: input.primaryUnitId } : {}),
      ...(input.secondaryUnitId !== undefined ? { secondaryUnitId: input.secondaryUnitId } : {}),
      ...(input.secondaryToPrimaryFactor !== undefined ? { secondaryToPrimaryFactor: input.secondaryToPrimaryFactor } : {}),
      ...(input.allowSalesInSecondaryUnit !== undefined ? { allowSalesInSecondaryUnit: input.allowSalesInSecondaryUnit } : {}),
      ...(input.allowPurchaseInSecondaryUnit !== undefined ? { allowPurchaseInSecondaryUnit: input.allowPurchaseInSecondaryUnit } : {}),
      ...(input.allowSecondaryFraction !== undefined ? { allowSecondaryFraction: input.allowSecondaryFraction } : {}),
    },
    create: {
      businessId: auth.businessId,
      itemId,
      primaryUnitId: input.primaryUnitId,
      secondaryUnitId: input.secondaryUnitId,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      allowSalesInSecondaryUnit: input.allowSalesInSecondaryUnit ?? false,
      allowPurchaseInSecondaryUnit: input.allowPurchaseInSecondaryUnit ?? false,
      allowSecondaryFraction: input.allowSecondaryFraction ?? false,
    },
  });
  return updated;
}
