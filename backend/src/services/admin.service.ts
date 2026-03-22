import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { HttpError } from "../lib/http";
import { listQuerySchema } from "../models/common.model";
import { suggestedPermissions } from "../constants/permissions";

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

export async function updateRole(
  auth: AuthUser,
  roleId: string,
  input: { name?: string; description?: string; permissions?: string[] },
) {
  const existing = await prisma.role.findFirst({ where: { id: roleId, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Role not found");
  return prisma.role.update({
    where: { id: roleId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
    },
  });
}

export async function deleteRole(auth: AuthUser, roleId: string) {
  const existing = await prisma.role.findFirst({ where: { id: roleId, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Role not found");
  const usersUsingRole = await prisma.user.count({
    where: { businessId: auth.businessId, roleId },
  });
  if (usersUsingRole > 0) {
    throw new HttpError(400, "Cannot delete role in use by users");
  }
  await prisma.role.delete({ where: { id: roleId } });
  return { id: roleId };
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

export async function updateUser(
  auth: AuthUser,
  userId: string,
  input: { fullName?: string; email?: string; password?: string; phone?: string; roleId?: string },
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId: auth.businessId },
  });
  if (!existing) throw new HttpError(404, "User not found");
  if (input.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: input.roleId, businessId: auth.businessId },
    });
    if (!role) throw new HttpError(404, "Role not found");
  }
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    include: { role: true },
  });
}

export async function deleteUser(auth: AuthUser, userId: string) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId: auth.businessId },
  });
  if (!existing) throw new HttpError(404, "User not found");
  await prisma.user.delete({ where: { id: userId } });
  return { id: userId };
}

export async function simpleCreate<T extends "unit" | "category" | "subCategory" | "brand" | "taxRate">(
  kind: T,
  auth: AuthUser,
  data: Record<string, unknown>,
) {
  if (kind === "unit")
    return prisma.unit.create({ data: { ...(data as { name: string; symbol: string; decimalPrecision?: number }), businessId: auth.businessId } });
  if (kind === "category")
    return prisma.$transaction(async (tx) => {
      const payload = data as {
        name: string;
        description?: string;
        imageUrl?: string;
        subcategories?: Array<{ title: string; description?: string; imageUrl?: string }>;
      };
      const category = await tx.category.create({
        data: {
          name: payload.name,
          description: payload.description,
          imageUrl: payload.imageUrl,
          businessId: auth.businessId,
        },
      });
      const nested = payload.subcategories ?? [];
      if (nested.length) {
        await tx.subCategory.createMany({
          data: nested
            .map((entry) => ({
              businessId: auth.businessId,
              categoryId: category.id,
              name: entry.title?.trim(),
              description: entry.description?.trim() || undefined,
              imageUrl: entry.imageUrl?.trim() || undefined,
            }))
            .filter((entry) => Boolean(entry.name)),
        });
      }
      return category;
    });
  if (kind === "subCategory") {
    const payload = data as {
      title: string;
      description?: string;
      categoryId?: string;
      imageUrl?: string;
    };
    return prisma.subCategory.create({
      data: {
        name: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        imageUrl: payload.imageUrl,
        businessId: auth.businessId,
      },
    });
  }
  if (kind === "brand")
    return prisma.brand.create({ data: { ...(data as { name: string }), businessId: auth.businessId } });
  return prisma.taxRate.create({
    data: {
      ...(data as { name: string; ratePercent: number; code?: string; isActive?: boolean }),
      businessId: auth.businessId,
    },
  });
}

export async function simpleList<T extends "unit" | "category" | "subCategory" | "brand" | "taxRate">(kind: T, auth: AuthUser) {
  return simpleListWithQuery(kind, auth, {});
}

export async function simpleListWithQuery<T extends "unit" | "category" | "subCategory" | "brand" | "taxRate">(
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
    const categories = await prisma.category.findMany({
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
    const categoryIds = categories.map((category) => category.id);
    const subRows = categoryIds.length
      ? await prisma.subCategory.findMany({
          where: { businessId: auth.businessId, categoryId: { in: categoryIds } },
          orderBy: { name: "asc" },
        })
      : [];
    const subByCategory = new Map<string, Array<{ title: string; description?: string; imageUrl?: string }>>();
    for (const row of subRows) {
      if (!row.categoryId) continue;
      const bucket = subByCategory.get(row.categoryId) ?? [];
      bucket.push({
        title: row.name,
        description: row.description ?? undefined,
        imageUrl: row.imageUrl ?? undefined,
      });
      subByCategory.set(row.categoryId, bucket);
    }
    return categories.map((category) => ({
      ...category,
      subcategories: subByCategory.get(category.id) ?? [],
    }));
  }
  if (kind === "subCategory") {
    const rows = await prisma.subCategory.findMany({
      where: {
        businessId: auth.businessId,
        OR: list.search
          ? [
              { name: { contains: list.search, mode: "insensitive" } },
              { description: { contains: list.search, mode: "insensitive" } },
              { categoryId: { contains: list.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    });
    return rows.map((row) => ({
      ...row,
      title: row.name,
    }));
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

export async function simpleUpdate<T extends "unit" | "category" | "subCategory" | "brand" | "taxRate">(
  kind: T,
  auth: AuthUser,
  id: string,
  data: Record<string, unknown>,
) {
  if (kind === "unit") {
    const existing = await prisma.unit.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Unit not found");
    return prisma.unit.update({ where: { id }, data });
  }
  if (kind === "category") {
    const existing = await prisma.category.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Category not found");
    const payload = data as {
      name?: string;
      description?: string;
      imageUrl?: string;
      subcategories?: Array<{ title: string; description?: string; imageUrl?: string }>;
    };
    return prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
        },
      });
      if (payload.subcategories !== undefined) {
        await tx.subCategory.deleteMany({ where: { businessId: auth.businessId, categoryId: id } });
        const normalized = payload.subcategories
          .map((entry) => ({
            title: entry.title?.trim(),
            description: entry.description?.trim() || undefined,
            imageUrl: entry.imageUrl?.trim() || undefined,
          }))
          .filter((entry) => Boolean(entry.title));
        if (normalized.length) {
          await tx.subCategory.createMany({
            data: normalized.map((entry) => ({
              businessId: auth.businessId,
              categoryId: id,
              name: entry.title as string,
              description: entry.description,
              imageUrl: entry.imageUrl,
            })),
          });
        }
      }
      return updated;
    });
  }
  if (kind === "subCategory") {
    const existing = await prisma.subCategory.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Subcategory not found");
    const payload = data as { title?: string; description?: string; categoryId?: string; imageUrl?: string };
    return prisma.subCategory.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { name: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
        ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
      },
    });
  }
  if (kind === "brand") {
    const existing = await prisma.brand.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Brand not found");
    return prisma.brand.update({ where: { id }, data });
  }
  const existing = await prisma.taxRate.findFirst({ where: { id, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Tax rate not found");
  return prisma.taxRate.update({ where: { id }, data });
}

export async function simpleDelete<T extends "unit" | "category" | "subCategory" | "brand" | "taxRate">(
  kind: T,
  auth: AuthUser,
  id: string,
) {
  if (kind === "unit") {
    const existing = await prisma.unit.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Unit not found");
    await prisma.unit.delete({ where: { id } });
    return { id };
  }
  if (kind === "category") {
    const existing = await prisma.category.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Category not found");
    await prisma.$transaction([
      prisma.subCategory.deleteMany({ where: { businessId: auth.businessId, categoryId: id } }),
      prisma.category.delete({ where: { id } }),
    ]);
    return { id };
  }
  if (kind === "subCategory") {
    const existing = await prisma.subCategory.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Subcategory not found");
    await prisma.subCategory.delete({ where: { id } });
    return { id };
  }
  if (kind === "brand") {
    const existing = await prisma.brand.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) throw new HttpError(404, "Brand not found");
    await prisma.brand.delete({ where: { id } });
    return { id };
  }
  const existing = await prisma.taxRate.findFirst({ where: { id, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Tax rate not found");
  await prisma.taxRate.delete({ where: { id } });
  return { id };
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
