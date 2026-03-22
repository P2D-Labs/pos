const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
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
  "subcategories.view",
  "subcategories.create",
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
  "inventory.view",
  "inventory.adjust",
  "payments.view",
  "payments.create",
  "refunds.view",
  "refunds.create",
  "ledger.view",
  "audit.view",
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  let business = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: process.env.SEED_BUSINESS_NAME || "Demo POS Business",
        ownerName: process.env.SEED_OWNER_NAME || "System Owner",
        email: process.env.SEED_BUSINESS_EMAIL || "owner@demo.local",
        phone: process.env.SEED_BUSINESS_PHONE || "0700000000",
      },
    });
  }

  const superAdminRole =
    (await prisma.role.findFirst({ where: { businessId: business.id, name: "Super Admin" } })) ||
    (await prisma.role.create({
      data: {
        businessId: business.id,
        name: "Super Admin",
        description: "Full system access",
        permissions: ALL_PERMISSIONS,
      },
    }));

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@demo.local";
  const adminPhone = process.env.SEED_ADMIN_PHONE || "0710000000";
  const adminName = process.env.SEED_ADMIN_NAME || "Super Admin";

  const existingByEmail = await prisma.user.findFirst({
    where: { businessId: business.id, email: adminEmail },
  });
  const existingByPhone = await prisma.user.findFirst({
    where: { businessId: business.id, phone: adminPhone },
  });
  let adminUser = existingByEmail ?? existingByPhone;
  if (adminUser) {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        fullName: adminName,
        email: adminEmail || null,
        phone: adminPhone,
        passwordHash: adminHash,
        roleId: superAdminRole.id,
        isActive: true,
      },
    });
  } else {
    adminUser = await prisma.user.create({
      data: {
        businessId: business.id,
        fullName: adminName,
        email: adminEmail || null,
        phone: adminPhone,
        passwordHash: adminHash,
        roleId: superAdminRole.id,
      },
    });
  }

  await prisma.businessSettings.upsert({
    where: { id: `${business.id}-settings` },
    update: {
      updatedBy: adminUser.id,
      moduleToggles: {
        reports: true,
        pos: true,
        quotations: true,
        salesOrders: true,
        salesInvoices: true,
        purchases: true,
        inventory: true,
        payments: true,
        salesReturns: true,
      },
      themeConfig: { primaryColor: "#f34e4e", radius: 12, fontFamily: "Inter" },
      invoiceTemplate: { footerText: "Thank you for your business." },
      nonTaxTemplate: { footerText: "Non-tax invoice. Thank you." },
      paymentMethods: ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"],
      allowedDiscount: 100000,
    },
    create: {
      id: `${business.id}-settings`,
      businessId: business.id,
      updatedBy: adminUser.id,
      moduleToggles: {
        reports: true,
        pos: true,
        quotations: true,
        salesOrders: true,
        salesInvoices: true,
        purchases: true,
        inventory: true,
        payments: true,
        salesReturns: true,
      },
      themeConfig: { primaryColor: "#f34e4e", radius: 12, fontFamily: "Inter" },
      invoiceTemplate: { footerText: "Thank you for your business." },
      nonTaxTemplate: { footerText: "Non-tax invoice. Thank you." },
      paymentMethods: ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"],
      allowedDiscount: 100000,
    },
  });

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "SalesOrder" SET "balanceDue" = "grandTotal" - "amountPaid"`,
    );
  } catch (e) {
    console.warn("Sales order balance sync skipped:", e?.message ?? e);
  }

  const walkIn = await prisma.customer.findFirst({
    where: { businessId: business.id, customerType: "WALK_IN" },
  });
  if (!walkIn) {
    await prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Walk-in Customer",
        customerType: "WALK_IN",
        isActive: true,
      },
    });
    console.log("Walk-in customer created.");
  }

  console.log("Seed completed (super admin only).");
  console.log(`Business: ${business.name} (${business.id})`);
  console.log(`Admin login email: ${adminEmail}`);
  console.log(`Admin login phone: ${adminPhone}`);
  console.log(`Admin password: ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
