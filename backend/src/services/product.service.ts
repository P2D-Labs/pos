import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { productListQuerySchema, productSchema } from "../models/product.model";

export async function listProducts(auth: AuthUser, query: unknown) {
  const input = productListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  return prisma.item.findMany({
    where: {
      businessId: auth.businessId,
      OR: input.search
        ? [
            { name: { contains: input.search, mode: "insensitive" } },
            { code: { contains: input.search, mode: "insensitive" } },
            { sku: { contains: input.search, mode: "insensitive" } },
            { barcode: { contains: input.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createProduct(auth: AuthUser, payload: unknown) {
  const input = productSchema.parse(payload);
  return prisma.item.create({
    data: {
      ...input,
      businessId: auth.businessId,
      secondaryToPrimaryFactor: input.secondaryToPrimaryFactor,
      salesPricePrimary: input.salesPricePrimary,
      purchasePricePrimary: input.purchasePricePrimary,
    },
  });
}
