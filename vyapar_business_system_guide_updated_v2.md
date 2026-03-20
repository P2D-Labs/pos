You are a intelligent system developer. We are going to develop a fully customizable stand-alone pos system (like vyapar).
Design keep it common uniform way how the upto date systems are. I have also attached a image for a panel pages reference.
Have proper query optimization, table sorts, sort, filters. Image, video optimized.
Color theme, font, radius, etc everything should be changable from a single global point.
And have example env, everything such as database credintials, tokens, etc should be available there.
In short this is a system which I will be giving this to a client with super admin credintials, they will be updating business details, create roles and permissions, products, categories, etc. Then make orders, return, etc.
Keep the system secure, validates, sanitized with whatever needed.
Have seperate backend and frontend folders and build within them. 
The below is more detailed view of the expected system, tiny changes such as some variables are allowed, but make sure the flow remains the same.

# Vyapar-like Business System Guide for Cursor

## 1. Purpose

This document is a copy-pasteable implementation guide for building a Vyapar-like business management system with POS/till capability, inventory, invoicing, purchasing, returns, payments, reporting, and customization.

It combines:

- a Vyapar-like business flow
- the till/POS concepts from the existing Crystal system
- a modern web stack approach

This guide intentionally ignores:

- shift management
- session management

This guide assumes the system will be built with:

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL
- **Auth:** JWT + refresh tokens
- **Storage/Caching:** session storage where needed on client, database + Redis optional on server
- **UI goals:** mobile responsive, modern UX, fast workflows, loading states, strong validation, security, sanitization, and full customization support

---

## 2. Product Goal

Build a small-business operating system that allows a business to:

- manage products and services
- maintain inventory with primary and secondary units
- create quotations, invoices, purchases, and returns
- handle POS/till billing
- track payments, payables, and refunds
- print/share bills
- generate reports
- support configurable workflows, document templates, taxes, numbering, and permissions

The system should be usable by:

- retail shops
- wholesalers
- pharmacies/general stores
- service businesses
- distributors
- small manufacturers

---

## 3. Core Modules

1. Authentication & Authorization
2. Business / Organization Settings
3. Users / Roles / Permissions
4. Customers
5. Suppliers
6. Products / Services / Categories / Brands
7. Units & Secondary Unit Conversion
8. Pricing & Price History
9. Inventory & Stock Ledger
10. Quotations
11. Sales Orders / Sales Invoices / POS Bills
12. Non-Tax Sales Orders / Non-Tax Sales Invoices
13. Purchases
14. Sales Returns
15. Payments / Refunds
16. Expenses
17. Accounting Lite / Ledger
18. Thermal Receipt / PDF Print
19. Reports & Dashboard
20. Settings & Customization
21. Audit Logs / Security Controls

---

## 4. High-Level Business Flow

### 4.1 Setup Flow

1. Register business (Seed super admin, he will add basic details of the business, this is what I meant by register)
2. Configure tax settings
3. Configure document numbering and invoice formats
4. Configure branches/stores if needed
5. Create users and roles
6. Create units, categories(optional subcategories) , brands
7. Add customers and suppliers
8. Add products with stock and prices
9. Set opening balances and opening stock
10. Start operations

### 4.2 Tax Sales Flow

1. Select customer or walk-in customer
2. Search/scan/select product
3. Pick quantity and unit
4. Resolve price using pricing engine
5. Apply discounts if allowed
6. Calculate tax
7. Accept payment or mark due
8. Save order/invoice
9. Deduct stock
10. Update customer ledger
11. Print/share receipt or invoice

### 4.3 Non-Tax Sales Flow

1. Select customer or walk-in customer
2. Search/scan/select product
3. Pick quantity and unit
4. Resolve price using pricing engine
5. Save as **non-tax order** or **non-tax invoice**
6. Do not apply tax
7. Deduct stock
8. Track in separate document series and separate reports
9. Restrict viewing to users with special permission
10. Print/share using non-tax format

### 4.4 Quotation Flow

1. Select customer
2. Add products/services
3. Determine price from pricing engine
4. Save quotation
5. Convert quotation to sales invoice later

### 4.5 Purchase Flow

1. Select supplier
2. Add products
3. Enter quantity in primary or secondary unit
4. Enter purchase cost and tax
5. Increase stock
6. Update supplier payable
7. Update item cost history and last inventory update price

### 4.6 Return Flow

1. Select original sales invoice
2. Select returned items from that invoice
3. Enter return quantity
4. Validate that return does not exceed sold quantity
5. Choose return method: **cash refund** or **exchange**
6. Save return transaction
7. Increase stock back for returned items
8. Update refund/exchange accounting entries
9. Print return receipt if needed

### 4.7 Expense Flow

1. Choose expense category
2. Enter amount and payment method
3. Save expense
4. Update cash/bank and expense report

---

## 5. Technology Architecture

## 5.1 Frontend

- React + TypeScript
- Tailwind CSS
- React Router
- TanStack Query for server state
- Zustand or Redux Toolkit for app state where required
- React Hook Form + Zod for form validation
- Session storage for temporary UI persistence where needed
- Component library optional but should remain customizable

## 5.2 Backend

- Express.js + TypeScript
- Modular architecture by domain
- JWT access token
- Refresh token rotation
- Helmet for security headers
- CORS with strict origin rules
- express-rate-limit for abuse control
- Zod / Joi / class-validator for request validation
- xss-clean style sanitization and manual sanitization policies
- bcrypt/argon2 for password hashing
- audit logging middleware

## 5.3 Database

- PostgreSQL
- Prisma or TypeORM recommended
- Optional Redis for caching, token/session tracking, throttling

## 5.4 File / Print Support

- PDF invoice generation
- thermal receipt HTML generation
- file storage for logos, attachments, receipts

---

## 6. Security Requirements

### 6.1 Authentication

- JWT short-lived access token
- refresh token stored securely and rotatable
- token revocation support
- logout from current device and all devices

### 6.2 Authorization

- role-based access control
- permission-level control per module and action
- branch/store level data restrictions if applicable
- special permissions for viewing and managing non-tax sales documents

### 6.3 Input Safety

- validate all request bodies, params, and query strings
- sanitize strings before storage and before render
- prevent SQL injection via ORM and parameterized queries
- escape HTML in printable notes/comments where needed

### 6.4 Operational Security

- rate limiting for auth endpoints
- IP/device logging for critical actions
- audit trail for sensitive changes
- soft delete where possible
- CSRF protection if cookie-based refresh strategy is used

---

## 7. Customization Principles

Everything important should be customizable:

- tax rules
- invoice templates
- fields shown in product/customer/supplier forms
- document numbering formats
- tax vs non-tax print formats
- business terminology labels
- payment methods
- allowed discounts
- print layouts
- theme/branding
- role permissions
- optional modules on/off

---

## 8. Core Data Entities

## 8.1 Business

```ts
Business {
  id: string
  name: string
  legalName?: string
  ownerName?: string
  email?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  taxRegistrationNo?: string
  currency: string
  timezone: string
  financialYearStart?: string
  logoUrl?: string
  signatureUrl?: string

  taxInvoicePrefix?: string        // example: INV
  nonTaxInvoicePrefix?: string     // example: NINV
  taxOrderPrefix?: string          // example: ORD
  nonTaxOrderPrefix?: string       // example: NORD
  quotationPrefix?: string         // example: QT
  purchasePrefix?: string          // example: PUR
  salesReturnPrefix?: string       // example: RET

  receiptFooter?: string
  createdAt: Date
  updatedAt: Date
}
```

## 8.2 User

```ts
User {
  id: string
  businessId: string
  fullName: string
  email?: string
  phone?: string
  passwordHash: string
  roleId: string
  isActive: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

## 8.3 Role

```ts
Role {
  id: string
  businessId: string
  name: string
  description?: string
  permissions: string[]
}
```

### 8.3.1 Suggested Permissions

```ts
permissions: [
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.cancel',
  'sales.non_tax.view',
  'sales.non_tax.create',
  'sales.non_tax.edit',
  'sales.non_tax.print',
  'purchases.view',
  'purchases.create',
  'returns.view',
  'returns.create',
]
```

## 8.4 Customer

```ts
Customer {
  id: string
  businessId: string
  code?: string
  name: string
  customerType: 'REGULAR' | 'WALK_IN'
  contactPerson?: string
  phone?: string
  email?: string
  billingAddress?: string
  shippingAddress?: string
  taxNo?: string
  creditLimit?: number
  paymentTermsDays?: number
  openingBalance?: number
  currentBalance: number
  isActive: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

## 8.5 Supplier

```ts
Supplier {
  id: string
  businessId: string
  code?: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  billingAddress?: string
  taxNo?: string
  paymentTermsDays?: number
  openingBalance?: number
  currentBalance: number
  isActive: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

## 8.6 Tax Rate

```ts
TaxRate {
  id: string
  businessId: string
  name: string
  ratePercent: number
  code?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## 9. Units and Secondary Units

Each inventory item can have:

- **Primary Unit**: main stock keeping unit
- **Secondary Unit**: alternate selling/purchasing/display unit
- **Conversion Rule**: how secondary unit converts into primary unit

Example:

- Primary unit: Packet
- Secondary unit: Box
- 1 Box = 12 Packets

Another example:

- Primary unit: Piece
- Secondary unit: Carton
- 1 Carton = 24 Pieces

### 9.1 Unit Master

```ts
Unit {
  id: string
  businessId: string
  name: string
  symbol: string
  decimalPrecision: number
  isActive: boolean
}
```

### 9.2 Item Unit Configuration

```ts
ItemUnitConfig {
  id: string
  itemId: string
  primaryUnitId: string
  secondaryUnitId?: string
  secondaryToPrimaryFactor?: number
  allowSalesInSecondaryUnit: boolean
  allowPurchaseInSecondaryUnit: boolean
  allowSecondaryFraction: boolean
}
```

### 9.3 Rules

1. Stock must always be stored in **primary unit** internally.
2. User may enter purchase/sale quantity in primary or secondary unit.
3. On save, quantities convert to primary unit.
4. UI must display both where helpful.
5. Price history may be stored for both unit selections during transactions.
6. If selling in secondary unit, line quantity in stock ledger converts to primary quantity.

### 9.4 Example Conversion Logic

```ts
primaryQty = enteredUnit === 'PRIMARY'
  ? enteredQty
  : enteredQty * secondaryToPrimaryFactor
```

---

## 10. Product / Inventory Item Model

When adding inventory items, include stock, units, pricing, and default tax behavior.

```ts
Item {
  id: string
  businessId: string
  type: 'PRODUCT' | 'SERVICE'
  status: 'ACTIVE' | 'INACTIVE'
  name: string
  code?: string
  sku?: string
  barcode?: string
  categoryId?: string
  brandId?: string
  description?: string

  trackInventory: boolean
  allowNegativeStock: boolean

  itemUnitConfigId?: string
  primaryUnitId?: string
  secondaryUnitId?: string
  secondaryToPrimaryFactor?: number
  allowSalesInSecondaryUnit: boolean
  allowPurchaseInSecondaryUnit: boolean

  openingStockPrimary?: number
  currentStockPrimary: number
  reorderLevelPrimary?: number

  salesPricePrimary?: number
  purchasePricePrimary?: number

  taxable: boolean
  defaultTaxRateId?: string

  imageUrl?: string
  notes?: string

  createdAt: Date
  updatedAt: Date
}
```

### 10.1 Product UI Fields

When creating/editing an item, the form should support:

- item type
- item name
- code / SKU / barcode
- category / brand
- description
- track inventory toggle
- primary unit
- secondary unit
- conversion factor
- sales allowed in secondary unit toggle
- purchase allowed in secondary unit toggle
- opening stock
- reorder level
- sales price primary
- purchase price primary
- taxability toggle
- default tax rate
- image/upload
- notes

### 10.2 Pricing Clarification

- `salesPricePrimary` means the default selling price for the **primary unit**
- `purchasePricePrimary` means the default purchase cost for the **primary unit**
- No separate master fields are kept for secondary pricing
- If a transaction is done in secondary unit, the transaction price can be calculated from primary price or adjusted manually before saving
- Price history can still be stored for the selected unit in quotations, invoices, and purchases

---

## 11. Pricing Engine

This is critical.

### 11.1 Required Pricing Sources

When a product is selected in quotation, invoice, or POS, determine price using this priority:

1. **Last quoted price for that item**
2. **Last inventory update price for that item**
3. **Item sales price from primary price logic**
4. Manual override if user has permission

### 11.2 Last Quoted Price Rule

For each item + unit combination, store the latest quoted/sold price snapshot.

```ts
ItemPriceHistory {
  id: string
  businessId: string
  itemId: string
  sourceType: 'QUOTATION' | 'SALES_INVOICE' | 'PURCHASE' | 'PRICE_OVERRIDE' | 'INVENTORY_UPDATE'
  sourceId: string
  unitType: 'PRIMARY' | 'SECONDARY'
  unitId: string
  price: number
  discountAmount?: number
  taxInclusive?: boolean
  createdAt: Date
}
```

### 11.3 Price Resolution Function

```ts
function resolveItemPrice(input: {
  itemId: string
  unitType: 'PRIMARY' | 'SECONDARY'
  secondaryToPrimaryFactor?: number
}): ResolvedPrice {
  // priority:
  // 1. latest quoted/sold price for item + unit
  // 2. last inventory update price for item + unit
  // 3. default item primary sales price
  // 4. if selected unit is secondary, derive from primary price using factor
  // 5. manual entry if allowed
}
```

### 11.4 Pricing Metadata Returned to UI

```ts
ResolvedPrice {
  price: number
  source: 'LAST_QUOTED' | 'LAST_INVENTORY_UPDATE' | 'ITEM_DEFAULT' | 'DERIVED_FROM_PRIMARY' | 'MANUAL'
  sourceReferenceId?: string
  canEdit: boolean
}
```

### 11.5 Important Behavior

- When product is selected, auto-fill price from **last quoted price first**
- If no last quoted price exists, fallback to **last inventory update price**
- If unavailable, fallback to **item primary sales price**
- If selling in secondary unit and no unit-specific history exists, derive price from primary using conversion factor
- User should see the source badge in UI, for example:
  - Last quoted
  - Last inventory update
  - Default item price
  - Derived from primary
- Price recalculation should happen when:
  - selected unit changes
  - item changes

---

## 12. Tax Rules

### 12.1 Tax Model

Tax should be controlled in **three levels**:

1. **Product level**
   - each item has `taxable: boolean`
   - each item can have a `defaultTaxRateId`

2. **Order / Invoice level**
   - each sales order or invoice has `documentTaxMode`
   - values:
     - `'TAX'`
     - `'NON_TAX'`

3. **Line level snapshot**
   - when invoice is saved, each line stores the actual `taxRate` and `taxAmount`
   - this preserves history even if product tax settings change later

### 12.2 Rules

- Tax invoices use `documentTaxMode: 'TAX'`
- Non-tax invoices use `documentTaxMode: 'NON_TAX'`
- If document is non-tax, all tax amounts must be zero
- If item is non-taxable, its tax amount must be zero even inside a tax invoice
- Tax reports must include only tax documents
- Non-tax documents must be tracked separately

---

## 13. Inventory Ledger

Never trust only current stock. Keep a ledger.

```ts
StockTransaction {
  id: string
  businessId: string
  itemId: string
  transactionType:
    | 'OPENING'
    | 'PURCHASE'
    | 'PURCHASE_RETURN'
    | 'SALE'
    | 'SALE_RETURN'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'DAMAGE'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
  referenceType: string
  referenceId: string
  quantityPrimaryIn: number
  quantityPrimaryOut: number
  enteredQuantity: number
  enteredUnitType: 'PRIMARY' | 'SECONDARY'
  enteredUnitId?: string
  conversionFactor?: number
  unitCost?: number
  lineValue?: number
  note?: string
  transactionDate: Date
  createdBy: string
}
```

### 13.1 Rule

- All stock movements must convert to primary stock quantity.
- Keep original entered quantity + unit for audit and usability.

---

## 14. Quotation Module

### 14.1 Quotation Header

```ts
Quotation {
  id: string
  businessId: string
  quotationNo: string
  customerId: string
  quotationDate: Date
  expiryDate?: Date
  status: 'DRAFT' | 'CONFIRMED' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED'
  subtotal: number
  discountAmount: number
  taxAmount: number
  shippingCharge: number
  otherCharge: number
  grandTotal: number
  notes?: string
  terms?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### 14.2 Quotation Line

```ts
QuotationLine {
  id: string
  quotationId: string
  itemId: string
  itemNameSnapshot: string
  enteredQuantity: number
  unitType: 'PRIMARY' | 'SECONDARY'
  unitId: string
  conversionFactor?: number
  quantityPrimary: number
  unitPrice: number
  priceSource: 'LAST_QUOTED' | 'LAST_INVENTORY_UPDATE' | 'ITEM_DEFAULT' | 'DERIVED_FROM_PRIMARY' | 'MANUAL'
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
}
```

### 14.3 Quotation Behavior

- Auto-fill line price from pricing engine
- Save quotation price into price history so it becomes usable as the next “last quoted price”
- Allow convert to invoice

---

## 15. Sales Orders and Sales Invoices

### 15.1 Document Series Rules

Use separate running series:

- Tax orders: `ORD-1, ORD-2, ORD-3`
- Non-tax orders: `NORD-1, NORD-2, NORD-3`
- Tax invoices: `INV-1, INV-2, INV-3`
- Non-tax invoices: `NINV-1, NINV-2, NINV-3`
- Purchases: `PUR-1, PUR-2, PUR-3`
- Returns: `RET-1, RET-2, RET-3`

Each series must remain sequential within its own type.

### 15.2 Sales Order Header

```ts
SalesOrder {
  id: string
  businessId: string
  orderNo: string
  orderSeries: 'ORD' | 'NORD'
  documentTaxMode: 'TAX' | 'NON_TAX'
  customerId: string
  customerType: 'REGULAR' | 'WALK_IN'
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
  orderDate: Date
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### 15.3 Sales Invoice Header

```ts
SalesInvoice {
  id: string
  businessId: string
  invoiceNo: string
  invoiceSeries: 'INV' | 'NINV'
  documentTaxMode: 'TAX' | 'NON_TAX'
  customerId: string
  customerType: 'REGULAR' | 'WALK_IN'
  invoiceDate: Date
  dueDate?: Date
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'PART_PAID' | 'UNPAID' | 'CANCELLED'
  quotationId?: string
  salesOrderId?: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  shippingCharge: number
  otherCharge: number
  roundOffAmount: number
  grandTotal: number
  amountReceived: number
  balanceDue: number
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### 15.4 Sales Invoice Line

```ts
SalesInvoiceLine {
  id: string
  salesInvoiceId: string
  itemId: string
  itemNameSnapshot: string

  enteredQuantity: number
  unitType: 'PRIMARY' | 'SECONDARY'
  unitId: string
  conversionFactor?: number
  quantityPrimary: number

  unitPrice: number
  priceSource: 'LAST_QUOTED' | 'LAST_INVENTORY_UPDATE' | 'ITEM_DEFAULT' | 'DERIVED_FROM_PRIMARY' | 'MANUAL'
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number

  costPriceSnapshot?: number
  profitAmount?: number
}
```

### 15.5 Visibility Rules

- Users with normal sales permission can see tax orders and tax invoices
- Only users with `sales.non_tax.view` permission can see non-tax orders and non-tax invoices
- Only users with `sales.non_tax.create` permission can create non-tax orders and non-tax invoices
- Non-tax documents must still remain in the database, stock ledger, and audit trail
- Non-tax documents must appear in separate reports and separate searches based on permission

### 15.6 Invoice Completion Flow

1. Validate invoice
2. Save invoice header and lines
3. Create stock out transactions using quantityPrimary
4. Create ledger entries
5. Create payment rows if any
6. Save price history from invoice lines
7. Print/share receipt or invoice using the correct tax or non-tax format

---

## 16. Purchase Module

### 16.1 Purchase Header

```ts
Purchase {
  id: string
  businessId: string
  purchaseNo: string
  supplierId: string
  purchaseDate: Date
  dueDate?: Date
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'PART_PAID' | 'UNPAID' | 'CANCELLED'
  subtotal: number
  discountAmount: number
  taxAmount: number
  shippingCharge: number
  otherCharge: number
  grandTotal: number
  amountPaid: number
  balancePayable: number
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### 16.2 Purchase Line

```ts
PurchaseLine {
  id: string
  purchaseId: string
  itemId: string
  itemNameSnapshot: string

  enteredQuantity: number
  unitType: 'PRIMARY' | 'SECONDARY'
  unitId: string
  conversionFactor?: number
  quantityPrimary: number

  unitCost: number
  taxRate: number
  taxAmount: number
  lineTotal: number
}
```

### 16.3 Purchase Behavior

- allow purchase in primary or secondary unit
- convert to primary stock
- update last purchase price
- update last inventory update price
- optionally update default purchase price

---

## 17. Sales Return Module

### 17.1 Return Rules

- return must be created **only from original sales invoice**
- no standalone sales return without invoice reference
- return can be:
  - **cash refund**
  - **exchange**
- **no credit note**
- **no store credit**
- returned quantity cannot exceed original sold quantity minus previously returned quantity

### 17.2 Sales Return Header

```ts
SalesReturn {
  id: string
  businessId: string
  salesReturnNo: string
  sourceInvoiceId: string
  customerId: string
  returnDate: Date
  returnMethod: 'CASH_REFUND' | 'EXCHANGE'
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  cashRefundAmount: number
  exchangeAdjustmentAmount: number
  note?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### 17.3 Sales Return Line

```ts
SalesReturnLine {
  id: string
  salesReturnId: string
  salesInvoiceLineId: string
  itemId: string
  itemNameSnapshot: string

  enteredQuantity: number
  unitType: 'PRIMARY' | 'SECONDARY'
  unitId: string
  conversionFactor?: number
  quantityPrimary: number

  unitPrice: number
  taxRate: number
  taxAmount: number
  lineTotal: number
  reason?: string
}
```

### 17.4 Return Behavior

- load items from original invoice
- allow selecting only invoiced items
- allow partial return
- stock increases back in primary unit
- for **cash refund**, create refund payment entry
- for **exchange**, create linked replacement sale flow or exchange adjustment flow
- print return receipt

---

## 18. Payments and Refunds

### 18.1 Payment Methods

- cash
- card
- bank transfer
- wallet
- cheque

### 18.2 Payment Row

```ts
PaymentRow {
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'CHEQUE'
  amount: number
  referenceNo?: string
  note?: string
}
```

### 18.3 Refund Row

```ts
RefundRow {
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'WALLET'
  amount: number
  referenceNo?: string
  note?: string
}
```

### 18.4 Refund Rule

- refund only applies to invoice-linked returns
- refund amount cannot exceed allowed return value
- refund only for **cash refund** return mode
- exchange return should adjust against replacement bill, not create credit

---

## 19. Expenses

```ts
Expense {
  id: string
  businessId: string
  expenseDate: Date
  categoryId: string
  paidTo?: string
  amount: number
  taxAmount?: number
  paymentMethod: string
  note?: string
  attachmentUrl?: string
  createdBy: string
  createdAt: Date
}
```

---

## 20. Accounting Lite / Ledger

### 20.1 Ledger Entry

```ts
LedgerEntry {
  id: string
  businessId: string
  entryDate: Date
  accountType: 'CUSTOMER' | 'SUPPLIER' | 'CASH' | 'BANK' | 'SALES' | 'PURCHASE' | 'EXPENSE' | 'TAX' | 'REFUND'
  accountId?: string
  referenceType: string
  referenceId: string
  debitAmount: number
  creditAmount: number
  narration?: string
}
```

### 20.2 Minimum Ledger Effects

- sales invoice increases customer receivable / sales
- payment received reduces receivable / increases cash or bank
- purchase increases payable / inventory or purchase
- expense reduces cash/bank and increases expense
- sales return reduces sales and updates stock
- cash refund reduces cash/bank
- non-tax sales still affect sales, stock, cash, and audit trails, but remain separate from tax reporting

---

## 21. Receipt Printing

### 21.1 Receipt Types

- thermal POS receipt
- A4 tax invoice PDF
- A4 non-tax invoice PDF
- quotation PDF
- purchase print/export
- sales return receipt

### 21.2 Receipt Content

- business logo/name
- document no
- date/time
- customer name
- item lines with quantity, unit, unit price, total
- subtotal
- tax if applicable
- discount
- grand total
- received amount
- balance or change
- served by/cashier name
- footer

### 21.3 Reprint Flow

1. Search invoices by date, customer, invoice no, amount, item
2. Open invoice details
3. Regenerate receipt HTML or PDF
4. Print/reprint based on document type and permission

---

## 22. Reports

Required reports:

- dashboard summary
- daily sales
- sales by item
- sales by customer
- quotation conversion report
- purchases by supplier
- stock summary
- stock movement
- low stock
- profit summary
- receivables
- payables
- sales return report
- refund report
- expense report
- tax sales report
- non-tax sales report
- user activity/audit report

### 22.1 Reporting Rules

- Tax reports must include only tax documents
- Non-tax reports must include only non-tax documents
- Users without non-tax permission must not see non-tax documents in search, reports, print, or dashboards
- Stock reports must reflect both tax and non-tax stock movement because inventory is real for both

---

## 23. API Design

Suggested route groups:

```ts
/auth
/users
/roles
/business
/settings
/customers
/suppliers
/items
/units
/categories
/brands
/tax-rates
/quotations
/sales-orders
/sales-invoices
/sales-returns
/purchases
/payments
/refunds
/expenses
/stock-transactions
/reports
/print
/audit-logs
```

### 23.1 Example Item APIs

```ts
GET /items
POST /items
GET /items/:id
PATCH /items/:id
DELETE /items/:id
GET /items/:id/price-history
GET /items/:id/resolved-price?unitType=PRIMARY
```

### 23.2 Example Pricing Endpoint

```ts
GET /items/:id/resolved-price?unitType=PRIMARY
```

Response:

```ts
{
  price: 1250,
  source: 'LAST_QUOTED',
  sourceReferenceId: 'quotation_123',
  canEdit: true
}
```

### 23.3 Example Sales APIs

```ts
POST /sales-orders
POST /sales-invoices
GET /sales-invoices?documentTaxMode=TAX
GET /sales-invoices?documentTaxMode=NON_TAX
```

### 23.4 Example Return APIs

```ts
POST /sales-returns
GET /sales-returns
GET /sales-returns/:id
POST /sales-returns/:id/print
GET /sales-invoices/:id/returnable-items
```

---

## 24. Frontend Pages

### 24.1 Auth

- login
- forgot password
- reset password
- device/session management

### 24.2 Dashboard

- KPI cards
- sales trends
- low stock
- dues/payables
- quick actions

### 24.3 Masters

- customers
- suppliers
- items
- categories
- brands
- units
- taxes
- roles/users

### 24.4 Transactions

- quotation list/create/edit
- tax sales order list/create/edit
- non-tax sales order list/create/edit
- tax sales invoice list/create/edit
- non-tax sales invoice list/create/edit
- POS/till page
- purchase list/create/edit
- sales returns
- payments/refunds
- expenses
- stock adjustment

### 24.5 Reports

- sales reports
- inventory reports
- finance reports
- audit reports

### 24.6 Settings

- business settings
- print templates
- numbering
- tax config
- permissions
- theme/branding
- module toggles

---

## 25. UX Requirements

### 25.1 General UX

- mobile responsive
- keyboard-friendly POS flow
- scanner-friendly input
- fast modals/drawers
- optimistic but safe interactions where appropriate
- empty states and guidance text
- skeleton loaders for lists/cards/forms
- inline and toast errors
- undo where reasonable for destructive actions

### 25.2 POS UX

- customer quick select
- barcode input with autofocus mode
- recent items/customers
- easy unit switch between primary/secondary
- price source badge on each line
- line-level edit permissions
- payment summary always visible
- tax vs non-tax mode switch based on permission
- print button visible after success

### 25.3 Product Form UX

- collapsible advanced fields
- live stock conversion preview
- live unit conversion preview
- preview of primary-unit pricing
- preview of derived secondary pricing when applicable

Example preview:

- Primary: Packet
- Secondary: Box
- Factor: 1 box = 12 packets
- Sale price primary: 100
- Derived box price: 1200

### 25.4 Return UX

- start return from invoice lookup
- show only returnable items
- show already returned quantity
- choose return mode clearly:
  - cash refund
  - exchange
- prevent over-return
- show refund/exchange summary before save

---

## 26. Loading, Error Handling, and Validation

### 26.1 Frontend

- route-level loading
- table loading skeletons
- form submit loading state
- retry button for failed fetches
- friendly empty states
- field-level validation messages

### 26.2 Backend

- standardized API response shape
- centralized error middleware
- request id / correlation id in logs
- structured validation errors

Example response:

```ts
{
  success: false,
  message: 'Validation failed',
  errors: {
    itemId: 'Invalid item',
    quantity: 'Quantity must be greater than 0'
  }
}
```

---

## 27. Audit Logging

Track at minimum:

- login/logout
- password change
- item create/update/delete
- price changes
- quotation create/update/convert
- tax order create/update/cancel
- non-tax order create/update/cancel
- tax invoice create/cancel
- non-tax invoice create/cancel
- purchase create/cancel
- sales return create/cancel
- payment receive/refund
- settings changes
- permission changes

```ts
AuditLog {
  id: string
  businessId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  before?: Json
  after?: Json
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}
```

---

## 28. Suggested Folder Structure

### 28.1 Frontend

```txt
src/
  app/
  components/
    common/
    forms/
    tables/
    pos/
    print/
  features/
    auth/
    dashboard/
    customers/
    suppliers/
    items/
    pricing/
    quotations/
    sales-orders/
    sales-invoices/
    sales-returns/
    purchases/
    payments/
    expenses/
    reports/
    settings/
  hooks/
  lib/
  services/
  types/
  utils/
```

### 28.2 Backend

```txt
src/
  modules/
    auth/
    users/
    roles/
    business/
    customers/
    suppliers/
    units/
    items/
    pricing/
    tax-rates/
    quotations/
    sales-orders/
    sales-invoices/
    sales-returns/
    purchases/
    payments/
    expenses/
    inventory/
    reports/
    settings/
    audit/
  middleware/
  lib/
  utils/
  config/
  types/
```

---

## 29. Implementation Roadmap

### Phase 1: Core Setup

- auth
- users/roles
- business settings
- numbering settings
- tax rate settings
- units and item masters
- customers/suppliers

### Phase 2: Inventory + Pricing

- stock ledger
- primary/secondary units
- product primary pricing
- derived secondary pricing
- last quoted price engine
- last inventory update price fallback

### Phase 3: Sales + Quotations

- quotation module
- sales order module
- sales invoice module
- tax vs non-tax document flow
- POS/till page
- thermal receipt printing

### Phase 4: Purchase + Returns + Expenses

- purchase module
- invoice-linked sales returns
- cash refund / exchange flow
- payments and refunds
- expenses

### Phase 5: Reports + Customization

- dashboards
- tax and non-tax sales reports
- sales/inventory/finance reports
- print customization
- audit logs

---

## 30. Non-Negotiable Rules

1. Stock is stored internally in primary unit.
2. Every item can optionally support a secondary unit.
3. Every cart/quotation/invoice line must store entered quantity and converted primary quantity.
4. Product master keeps only **primary sales price** and **primary purchase price**.
5. If transaction is done in secondary unit, price may be derived from primary price or adjusted manually.
6. Price should primarily come from **last quoted price for the item**.
7. If unavailable, fallback must be **last inventory update price**, then **product primary sales price**.
8. Customers and suppliers must be stored in **separate tables**.
9. Walk-in customer must exist inside **customers**, not as a supplier or mixed party table record.
10. Sales return must be created **only by original invoice**.
11. Return outcome can only be **cash refund** or **exchange**.
12. **No credit note / no store credit** flow.
13. Tax and non-tax orders/invoices must be tracked separately with separate document series.
14. Only users with special permission can view or create non-tax documents.
15. Non-tax documents must still affect stock, payments, ledgers, and audit trails.
16. All critical writes must be validated, sanitized, and audited.
17. UI must be fast, mobile responsive, and customizable.
18. Printing and reprinting must be supported.
19. Security, token handling, refresh flow, and role permissions must be built in from the start.

---

## 31. Cursor Prompt Starter

Use this prompt inside Cursor to start implementation:

```txt
Build a full-stack Vyapar-like business management system using React, TypeScript, Tailwind CSS, Express.js, PostgreSQL, and JWT auth with refresh tokens.

Requirements:
- mobile responsive modern UI with excellent UX
- role-based auth and permissions
- strong validation, sanitization, loading states, and error handling
- session storage where useful on frontend
- customizable settings, invoice templates, taxes, numbering, pricing rules, and modules
- separate tables for customers and suppliers
- keep walk-in customer within customers table
- item master with primary and secondary units
- stock always stored in primary units internally
- each item can have secondary conversion (example: 1 box = 12 packets)
- product master should only keep primary sales price and primary purchase price
- if selling or buying in secondary unit, derive price from primary or allow manual adjustment
- quotation, sales order, sales invoice, purchase, sales return, payment, refund, expense, stock ledger, reports
- separate tax and non-tax orders/invoices
- use separate numbering series:
  - ORD for tax orders
  - NORD for non-tax orders
  - INV for tax invoices
  - NINV for non-tax invoices
  - PUR for purchases
  - RET for returns
- non-tax documents must only be visible and manageable by users with special permission
- non-tax documents must still remain in database, stock ledger, payments, reports by permission, and audit logs
- tax should work in three levels:
  1. product-level taxable flag and default tax rate
  2. document-level TAX or NON_TAX mode
  3. line-level tax snapshot on save
- POS/till page with barcode/search add-to-cart flow
- when selecting an item, resolve price using this priority:
  1. last quoted price for the item and unit
  2. last inventory update price for the item and unit
  3. item default primary sales price
  4. derived secondary price if needed
  5. manual override if user has permission
- save quotation/invoice prices into price history for future last quoted resolution
- sales return must be by original invoice only
- return can only be cash refund or exchange
- no credit note and no store credit flow
- include thermal receipt printing and invoice reprint flow
- include audit logs

Generate:
1. database schema
2. backend module structure
3. REST API endpoints
4. frontend page structure
5. React components and hooks
6. validation schemas
7. pricing engine implementation
8. stock conversion utilities
9. POS flow implementation
10. tax and non-tax sales flow implementation
11. sales return by invoice implementation
12. sample seed data
```

---

## 32. Final Note

This system should feel practical first.  
Not bloated. Not accountant-only. Not pretty-but-slow.

It should behave like a sharp cashier, a tidy storekeeper, and a patient bookkeeper living inside one screen.
