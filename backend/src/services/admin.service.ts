import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { HttpError } from "../lib/http";
import { listQuerySchema } from "../models/common.model";

export const suggestedPermissions = [
  "business.view",
  "roles.view",
  "roles.create",
  "users.view",
  "users.create",
  "sessions.view",
  "sessions.manage",
  "settings.view",
  "settings.manage",
  "customers.view",
  "customers.create",
  "suppliers.view",
  "suppliers.create",
  "products.view",
  "products.create",
  "units.view",
  "units.create",
  "categories.view",
  "categories.create",
  "brands.view",
  "brands.create",
  "taxRates.view",
  "taxRates.create",
  "sales.view",
  "sales.create",
  "sales.non_tax.view",
  "sales.non_tax.create",
  "sales.non_tax.print",
  "purchases.view",
  "purchases.create",
  "returns.view",
  "returns.create",
  "reports.view",
  "pricing.view",
  "pricing.override",
  "inventory.view",
  "inventory.adjust",
  "payments.view",
  "payments.create",
  "refunds.view",
  "refunds.create",
  "expenses.view",
  "expenses.create",
  "ledger.view",
  "audit.view",
] as const;

export async function getBusinessMe(auth: AuthUser) {
  return prisma.business.findUniqueOrThrow({ where: { id: auth.businessId } });
}

export async function listRoles(auth: AuthUser) {
  return listRolesWithQuery(auth, {});
}

export async function listRolesWithQuery(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.role.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { name: { contains: list.search, mode: "insensitive" } },
            { description: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { name: "asc" },
    skip,
    take,
  });
}

export async function createRole(auth: AuthUser, input: { name: string; description?: string; permissions: string[] }) {
  return prisma.role.create({
    data: {
      businessId: auth.businessId,
      name: input.name,
      description: input.description,
      permissions: input.permissions,
    },
  });
}

export async function listUsers(auth: AuthUser) {
  return listUsersWithQuery(auth, {});
}

export async function listUsersWithQuery(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.user.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { fullName: { contains: list.search, mode: "insensitive" } },
            { email: { contains: list.search, mode: "insensitive" } },
            { phone: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { role: true },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createUser(
  auth: AuthUser,
  input: { fullName: string; email: string; password: string; phone?: string; roleId: string },
) {
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, businessId: auth.businessId },
  });
  if (!role) throw new HttpError(404, "Role not found");
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      businessId: auth.businessId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: input.roleId,
    },
  });
}

export async function simpleCreate<T extends "unit" | "category" | "brand" | "taxRate">(
  kind: T,
  auth: AuthUser,
  data: Record<string, unknown>,
) {
  if (kind === "unit")
    return prisma.unit.create({ data: { ...(data as { name: string; symbol: string; decimalPrecision?: number }), businessId: auth.businessId } });
  if (kind === "category")
    return prisma.category.create({ data: { ...(data as { name: string }), businessId: auth.businessId } });
  if (kind === "brand")
    return prisma.brand.create({ data: { ...(data as { name: string }), businessId: auth.businessId } });
  return prisma.taxRate.create({
    data: {
      ...(data as { name: string; ratePercent: number; code?: string; isActive?: boolean }),
      businessId: auth.businessId,
    },
  });
}

export async function simpleList<T extends "unit" | "category" | "brand" | "taxRate">(kind: T, auth: AuthUser) {
  return simpleListWithQuery(kind, auth, {});
}

export async function simpleListWithQuery<T extends "unit" | "category" | "brand" | "taxRate">(
  kind: T,
  auth: AuthUser,
  query: unknown,
) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  if (kind === "unit") {
    return prisma.unit.findMany({
      where: {
        businessId: auth.businessId,
        OR: list.search
          ? [
              { name: { contains: list.search, mode: "insensitive" } },
              { symbol: { contains: list.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    });
  }
  if (kind === "category") {
    return prisma.category.findMany({
      where: {
        businessId: auth.businessId,
        name: list.search ? { contains: list.search, mode: "insensitive" } : undefined,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    });
  }
  if (kind === "brand") {
    return prisma.brand.findMany({
      where: {
        businessId: auth.businessId,
        name: list.search ? { contains: list.search, mode: "insensitive" } : undefined,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    });
  }
  return prisma.taxRate.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { name: { contains: list.search, mode: "insensitive" } },
            { code: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { name: "asc" },
    skip,
    take,
  });
}

export async function updateNumbering(auth: AuthUser, input: Record<string, string>) {
  return prisma.business.update({
    where: { id: auth.businessId },
    data: input,
  });
}

export async function listAuditLogs(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.auditLog.findMany({
    where: { businessId: auth.businessId },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function listStockTransactions(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.stockTransaction.findMany({
    where: { businessId: auth.businessId },
    orderBy: { transactionDate: "desc" },
    skip,
    take,
  });
}

export async function listLedger(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.ledgerEntry.findMany({
    where: { businessId: auth.businessId },
    orderBy: { entryDate: "desc" },
    skip,
    take,
  });
}
