# POS workflow (reference)

> Temporary document: remove after implementation is complete and approved.  
> **Vyapar guide** (`vyapar_business_system_guide_updated_v2.md`) is a useful reference for tax/non-tax, numbering, and document shapes — **ignore branch/store concepts**; this product has **no branches**.

## Roles and access

- **Super admin** sets application settings, creates roles, and assigns users.
- Other users operate with assigned permissions for day-to-day work.

## Master data (created by users with permissions)

- **Customers** — Exactly **one** walk-in customer; **seed if missing**. Walk-in is **protected** (non-deletable; treat as system row). **Customer Type** is not shown on create — default `REGULAR` for normal customers; walk-in remains `WALK_IN` internally.
- **Suppliers**
- **Brands**
- **Categories** — **Nested tree**: a category may have **one or more** subcategories (subcategories can nest further as needed). An **item** may be linked to **category only**, or **category + subcategory** (where applicable).
- **Taxes**
- **Units**

## Items

- Items are created with full detail, linked to suppliers, brands, categories, taxes, units, etc.

## Sales order ↔ sales invoice (same lifecycle)

- **One POS order** produces **one sales order** and **one sales invoice** for that order (paired). The invoice row stores optional `salesOrderId` linking back to the order.
- **Sales order** — detailed view of the order (lines, totals, status, payments on `SALES_ORDER`).
- **Sales invoice** — exact invoice document (blueprint) for that order (tax or non-tax layout); **stock** and **SALES** ledger post on the invoice. **Till payments** remain recorded against the **sales order** (no duplicate payment rows on the invoice).
- **Tax vs non-tax** — `documentTaxMode` (`TAX` | `NON_TAX`). **Non-tax** orders/invoices: **view/create** gated by non-tax permissions.
- **Quotations** — Estimates **before** an order; **not** in Sales Order / Sales Invoice lists. Simple detail view (similar to sales order) + print. **No “convert quotation to order”** in the product **for now** (may be added later).

## Admin text — quotation & return disclaimers

- Super admin can set **two optional free-text notes** (e.g. *“Valid for 14 days from the date of issue.”*).
- One for **quotations** and one for **sales returns** (shown on screen/print where those documents are displayed).
- These are **advisory text** configured in settings — **no automatic date enforcement** unless we add that as a separate feature later.

## POS / Till — orders

1. Select **customer**.
2. Add **products** (line items).
3. **Taxes** when order is taxable and product has tax.
4. Add **payment method(s)** including optional **store credit** from returns (see below).
5. **Create order** (paired sales order + invoice).

**Suggested line price** (editable): last price on cart → last supplier purchase → item sales price.

## POS / Till — quotations

- Till **quotation** path saves under **Quotations** only.

## Purchases

- Supplier + items; stock adjusts.

## Sales returns — single transaction (no refund/exchange choice)

- User does **not** choose “refund” vs “exchange”. Creating a return is **one transaction**: pick **customer** → pick **invoice** → pick **one or more lines** (with quantities) from that invoice to return → save.
- **No double-dipping:** per invoice line, **returned quantity** cannot exceed **sold quantity minus already returned** (track cumulatively across return documents).
- **Money effect:** the return value increases the customer’s **usable credit** (store credit) used at the Till — see next section. (Implementation may keep one internal settlement path; **no staff-facing refund/exchange toggle**.)

## Till — applying return credit (store credit)

- If the customer has **available credit**, Till user can **select/use it** when applicable.
- **Apply the full available credit** toward the current cart (up to amount due).
- If **credit exceeds** the cart total: **pay out the excess as cash** (balance refunded to customer) at checkout — do **not** leave that excess as stranded credit when staff chooses to settle this way.
- If **credit is less** than due: customer pays the remainder with other tenders.

## Payments (invoice payments screen)

- Customer + amount + allocate to unpaid/partial invoices.
- **Leftover** after allocation: **always settle immediately** (change / cash back) — **no** persisted overpay balance.

## Printing

- **No standalone Print Center** page.
- **Thermal** + **normal** on **Sales Invoices** and **Quotations**; print prompt after POS order uses the **paired invoice** (thermal receipt + A4 tax/non-tax HTML).
- Quotations and returns **include** the admin-configured disclaimer lines when set.

## UI — large lists

- **Searchable** selects + **scrollable** dropdowns for customers, items, and other high-volume pickers.

---

## Implementation checklist (track until done)

- [x] Super admin: settings, roles, user assignment.
- [x] Settings: **quotation disclaimer** + **return disclaimer** text fields.
- [x] Walk-in: seed if missing; protected row; hide Customer Type on customer create.
- [x] Categories: nested tree; items: category-only or category + subcategory.
- [x] Master data: Suppliers, Brands, Categories, Taxes, Units.
- [x] Items: full links.
- [x] POS: paired order + invoice; non-tax permissions; suggested price; **store credit**: apply full, **cash out excess**.
- [x] Quotations: list/detail + print + disclaimer; **no convert** (backend convert endpoint may still exist).
- [x] Purchases: stock movement.
- [x] Returns: **no method toggle** in UI; invoice lines + qty caps; **transaction** only (credit to store).
- [x] Payments: allocation + immediate overpay settlement.
- [x] Remove Print Center; embed prints; searchable comboboxes.

## Notes vs current codebase (snapshot)

- Walk-in: seed ensures walk-in for existing DBs where missing.
- **Sales return** may still store `ReturnMethod` in DB; UI uses a single credit path.
- **Refunds** standalone module removed from the app; legacy `/refunds` API is gated by **sales returns** module toggle.
- **CustomSelect** supports `searchable` on heavy lists (POS, item editor, documents, etc.).
