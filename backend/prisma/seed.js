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
];

async function upsertByName(model, businessId, names) {
  const out = {};
  for (const name of names) {
    const existing = await model.findFirst({ where: { businessId, name } });
    const row = existing ?? (await model.create({ data: { businessId, name } }));
    out[name] = row;
  }
  return out;
}

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

  const managerRole =
    (await prisma.role.findFirst({ where: { businessId: business.id, name: "Manager" } })) ||
    (await prisma.role.create({
      data: {
        businessId: business.id,
        name: "Manager",
        description: "Operations manager",
        permissions: [
          "business.view",
          "settings.view",
          "customers.view",
          "customers.create",
          "suppliers.view",
          "suppliers.create",
          "products.view",
          "products.create",
          "sales.view",
          "sales.create",
          "purchases.view",
          "purchases.create",
          "returns.view",
          "returns.create",
          "payments.view",
          "payments.create",
          "refunds.view",
          "refunds.create",
          "expenses.view",
          "expenses.create",
          "inventory.view",
          "inventory.adjust",
          "pricing.view",
          "reports.view",
        ],
      },
    }));

  const cashierRole =
    (await prisma.role.findFirst({ where: { businessId: business.id, name: "Cashier" } })) ||
    (await prisma.role.create({
      data: {
        businessId: business.id,
        name: "Cashier",
        description: "Till and billing",
        permissions: [
          "business.view",
          "customers.view",
          "customers.create",
          "products.view",
          "sales.view",
          "sales.create",
          "returns.view",
          "returns.create",
          "payments.view",
          "payments.create",
          "pricing.view",
        ],
      },
    }));

  let adminUser = await prisma.user.findFirst({
    where: { businessId: business.id, fullName: "Super Admin" },
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        businessId: business.id,
        fullName: "Super Admin",
        email: process.env.SEED_ADMIN_EMAIL || null,
        phone: process.env.SEED_ADMIN_PHONE || "0710000000",
        passwordHash: adminHash,
        roleId: superAdminRole.id,
      },
    });
  }

  const managerUser = await prisma.user.findFirst({
    where: { businessId: business.id, fullName: "Store Manager" },
  });
  if (!managerUser) {
    await prisma.user.create({
      data: {
        businessId: business.id,
        fullName: "Store Manager",
        email: null,
        phone: "0710000001",
        passwordHash: adminHash,
        roleId: managerRole.id,
      },
    });
  }

  const cashierUser = await prisma.user.findFirst({
    where: { businessId: business.id, fullName: "Main Cashier" },
  });
  if (!cashierUser) {
    await prisma.user.create({
      data: {
        businessId: business.id,
        fullName: "Main Cashier",
        email: null,
        phone: "0710000002",
        passwordHash: adminHash,
        roleId: cashierRole.id,
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
        pricing: true,
        inventory: true,
        payments: true,
        refunds: true,
        expenses: true,
        printCenter: true,
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
        pricing: true,
        inventory: true,
        payments: true,
        refunds: true,
        expenses: true,
        printCenter: true,
        salesReturns: true,
      },
      themeConfig: { primaryColor: "#f34e4e", radius: 12, fontFamily: "Inter" },
      invoiceTemplate: { footerText: "Thank you for your business." },
      nonTaxTemplate: { footerText: "Non-tax invoice. Thank you." },
      paymentMethods: ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"],
      allowedDiscount: 100000,
    },
  });

  const units = await upsertByName(prisma.unit, business.id, ["Piece", "Box", "Kg", "Litre"]);
  const categories = await upsertByName(prisma.category, business.id, ["General", "Beverages", "Groceries"]);
  const brands = await upsertByName(prisma.brand, business.id, ["Local", "Premium"]);

  const vatRate =
    (await prisma.taxRate.findFirst({ where: { businessId: business.id, name: "VAT 18%" } })) ||
    (await prisma.taxRate.create({
      data: { businessId: business.id, name: "VAT 18%", code: "VAT18", ratePercent: 18 },
    }));

  await upsertByName(prisma.customer, business.id, ["Walk-in Customer", "Retail Customer", "Wholesale Customer"]);
  await upsertByName(prisma.supplier, business.id, ["Primary Supplier", "Backup Supplier"]);

  const itemRows = [
    {
      name: "Sugar 1kg",
      code: "ITM-SUGAR-1",
      sku: "SKU-SUGAR-1",
      barcode: "100000001",
      categoryId: categories.Groceries.id,
      brandId: brands.Local.id,
      primaryUnitId: units.Kg.id,
      salesPricePrimary: 260,
      purchasePricePrimary: 220,
      openingStockPrimary: 40,
      currentStockPrimary: 40,
      reorderLevelPrimary: 10,
      taxable: true,
      defaultTaxRateId: vatRate.id,
    },
    {
      name: "Milk Pack",
      code: "ITM-MILK-1",
      sku: "SKU-MILK-1",
      barcode: "100000002",
      categoryId: categories.Beverages.id,
      brandId: brands.Premium.id,
      primaryUnitId: units.Piece.id,
      salesPricePrimary: 180,
      purchasePricePrimary: 150,
      openingStockPrimary: 60,
      currentStockPrimary: 60,
      reorderLevelPrimary: 15,
      taxable: true,
      defaultTaxRateId: vatRate.id,
    },
    {
      name: "Delivery Service",
      code: "SRV-DEL-1",
      sku: "SKU-SRV-DEL-1",
      barcode: "200000001",
      categoryId: categories.General.id,
      brandId: brands.Local.id,
      primaryUnitId: units.Piece.id,
      salesPricePrimary: 500,
      purchasePricePrimary: 0,
      openingStockPrimary: 0,
      currentStockPrimary: 0,
      reorderLevelPrimary: 0,
      taxable: false,
      defaultTaxRateId: null,
      type: "SERVICE",
      trackInventory: false,
    },
  ];

  for (const item of itemRows) {
    const existing = await prisma.item.findFirst({
      where: { businessId: business.id, code: item.code },
    });
    if (existing) continue;
    await prisma.item.create({
      data: {
        businessId: business.id,
        type: item.type || "PRODUCT",
        name: item.name,
        code: item.code,
        sku: item.sku,
        barcode: item.barcode,
        categoryId: item.categoryId,
        brandId: item.brandId,
        trackInventory: item.trackInventory !== false,
        primaryUnitId: item.primaryUnitId,
        openingStockPrimary: item.openingStockPrimary,
        currentStockPrimary: item.currentStockPrimary,
        reorderLevelPrimary: item.reorderLevelPrimary,
        salesPricePrimary: item.salesPricePrimary,
        purchasePricePrimary: item.purchasePricePrimary,
        taxable: item.taxable,
        defaultTaxRateId: item.defaultTaxRateId,
      },
    });
  }

  console.log("Seed completed.");
  console.log(`Business: ${business.name} (${business.id})`);
  console.log(`Admin login email: ${process.env.SEED_ADMIN_EMAIL || "use /auth/setup email or phone-based user"}`);
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
