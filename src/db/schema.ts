// R1 tables from "STATIX 06 Data Model" in the vault. Vote, trade-in and credit tables wait for R2/R3.
// Money is integer VND. Timestamps are UTC (timestamptz).
import { sql } from "drizzle-orm";
import {
  boolean, check, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const dropState = pgEnum("drop_state", ["draft", "scheduled", "early_access", "public", "sold_out", "closed"]);
export const unitStatus = pgEnum("unit_status", ["available", "held", "sold", "retired"]);
export const holdStatus = pgEnum("hold_status", ["active", "converted", "expired", "released"]);
export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "confirmed", "packing", "shipped", "delivered", "completed", "cancelled", "refunded",
]);
export const paymentProvider = pgEnum("payment_provider", ["vnpay", "momo", "cod"]);
export const paymentStatus = pgEnum("payment_status", ["created", "pending", "succeeded", "failed", "cancelled"]);
export const adminRole = pgEnum("admin_role", ["owner", "ops", "fulfilment", "support", "community"]);

export const tier = pgTable("tier", {
  id: id(),
  code: text("code").notNull().unique(), // visitor | waitlist | member | founder
  earlyAccessMinutes: integer("early_access_minutes").notNull().default(0),
  capOverride: integer("cap_override"),
});

export const account = pgTable("account", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  phone: text("phone").unique(), // one phone per account counts toward the cap (FR-015)
  phoneVerified: boolean("phone_verified").notNull().default(false),
  passwordHash: text("password_hash"),
  tierId: uuid("tier_id").notNull().references(() => tier.id),
  locale: text("locale").notNull().default("vi"),
  createdAt: createdAt(),
});

export const address = pgTable("address", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => account.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(),
  province: text("province").notNull(),
  ward: text("ward").notNull(),
  street: text("street").notNull(),
  receiverPhone: text("receiver_phone").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

export const product = pgTable("product", {
  id: id(),
  slug: text("slug").notNull().unique(),
  skuFamily: text("sku_family").notNull(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const variant = pgTable("variant", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => product.id),
  colour: text("colour").notNull(),
  listPriceVnd: integer("list_price_vnd").notNull(),
}, (t) => [unique().on(t.productId, t.colour)]);

export const dropRun = pgTable("drop_run", {
  id: id(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  state: dropState("state").notNull().default("draft"),
  earlyAccessAt: ts("early_access_at"),
  publicAt: ts("public_at"),
  closeAt: ts("close_at"),
});

export const edition = pgTable("edition", {
  id: id(),
  dropId: uuid("drop_id").notNull().references(() => dropRun.id),
  variantId: uuid("variant_id").notNull().references(() => variant.id),
  size: integer("size").notNull(),
  priceVnd: integer("price_vnd").notNull(),
  perPersonCap: integer("per_person_cap").notNull().default(1),
  lockedAt: ts("locked_at"), // set when the drop goes public; size and price freeze (FR-097)
}, (t) => [unique().on(t.dropId, t.variantId), check("edition_size_positive", sql`${t.size} > 0`)]);

export const hold = pgTable("hold", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  editionId: uuid("edition_id").notNull().references(() => edition.id),
  status: holdStatus("status").notNull().default("active"),
  expiresAt: ts("expires_at").notNull(),
  extensions: integer("extensions").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  // one active hold per person per edition, supports the cap (06 §2)
  uniqueIndex("hold_one_active").on(t.accountId, t.editionId).where(sql`${t.status} = 'active'`),
]);

// Pre-created: saving an edition of size N inserts N rows. A hold takes the lowest free number
// with FOR UPDATE SKIP LOCKED, so sold + held can never exceed N.
export const editionUnit = pgTable("edition_unit", {
  id: id(),
  editionId: uuid("edition_id").notNull().references(() => edition.id),
  number: integer("number").notNull(),
  status: unitStatus("status").notNull().default("available"),
  holdId: uuid("hold_id").references(() => hold.id),
  heldUntil: ts("held_until"),
}, (t) => [unique().on(t.editionId, t.number)]);

export const waitlistEntry = pgTable("waitlist_entry", {
  id: id(),
  email: text("email").notNull(),
  emailNorm: text("email_norm").notNull(),
  dropId: uuid("drop_id").references(() => dropRun.id),
  status: text("status").notNull().default("pending"), // pending | confirmed | invited | left
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  phone: text("phone"),
  source: jsonb("source"), // UTM params
  locale: text("locale").notNull().default("vi"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  consentAt: ts("consent_at").notNull(),
  confirmedAt: ts("confirmed_at"),
  createdAt: createdAt(),
}, (t) => [unique().on(t.emailNorm, t.dropId)]);

export const invite = pgTable("invite", {
  id: id(),
  entryId: uuid("entry_id").notNull().references(() => waitlistEntry.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const customerOrder = pgTable("customer_order", {
  id: id(),
  orderNo: text("order_no").notNull().unique(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  status: orderStatus("status").notNull().default("pending"),
  paymentMethod: paymentProvider("payment_method").notNull(),
  subtotalVnd: integer("subtotal_vnd").notNull(),
  shippingVnd: integer("shipping_vnd").notNull(),
  totalVnd: integer("total_vnd").notNull(),
  preOrder: boolean("pre_order").notNull().default(false),
  shipTo: jsonb("ship_to").notNull(), // address snapshot at order time
  invoice: jsonb("invoice"), // company e-invoice details (FR-055)
  createdAt: createdAt(),
});

export const orderLine = pgTable("order_line", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => customerOrder.id),
  editionUnitId: uuid("edition_unit_id").notNull().references(() => editionUnit.id).unique(),
  priceVnd: integer("price_vnd").notNull(),
});

export const payment = pgTable("payment", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => customerOrder.id),
  provider: paymentProvider("provider").notNull(),
  providerTxnId: text("provider_txn_id").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  amountVnd: integer("amount_vnd").notNull(),
  status: paymentStatus("status").notNull().default("created"),
  raw: jsonb("raw"),
  createdAt: createdAt(),
});

export const refund = pgTable("refund", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payment.id),
  amountVnd: integer("amount_vnd").notNull(),
  method: text("method").notNull(), // original | bank_transfer
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const shipment = pgTable("shipment", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => customerOrder.id),
  carrier: text("carrier").notNull(), // ghn | ghtk | manual
  trackingCode: text("tracking_code"),
  status: text("status").notNull().default("created"),
  createdAt: createdAt(),
});

export const physicalUnit = pgTable("physical_unit", {
  id: id(),
  editionUnitId: uuid("edition_unit_id").notNull().references(() => editionUnit.id).unique(),
  serialNo: text("serial_no").notNull().unique(),
  qcResult: text("qc_result"),
  disposition: text("disposition"), // pre_loved | scrap
});

export const returnRequest = pgTable("return_request", {
  id: id(),
  orderLineId: uuid("order_line_id").notNull().references(() => orderLine.id),
  type: text("type").notNull(), // changed_mind | faulty | damaged | other
  rmaNo: text("rma_no").unique(),
  status: text("status").notNull().default("submitted"),
  reason: text("reason"),
  photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
  refundBank: jsonb("refund_bank"), // COD refunds only (FR-075)
  createdAt: createdAt(),
});

export const adminUser = pgTable("admin_user", {
  id: id(),
  email: text("email").notNull().unique(),
  role: adminRole("role").notNull(),
  passwordHash: text("password_hash"),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
});

// Append-only: the app never updates or deletes rows here (FR-088).
export const auditLog = pgTable("audit_log", {
  id: id(),
  adminId: uuid("admin_id").references(() => adminUser.id),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  at: ts("at").notNull().defaultNow(),
});

// A13 settings: hold minutes, caps, early-access minutes, COD limit.
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
