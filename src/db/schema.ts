import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const CATEGORIES = ["hospital", "pharmacy"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  hospital: "병원비",
  pharmacy: "약제비",
};

export const IMAGE_KINDS = ["receipt", "detail", "other"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_KIND_LABEL: Record<ImageKind, string> = {
  receipt: "영수증",
  detail: "세부내역서",
  other: "기타",
};

export const MAX_IMAGES_PER_RECEIPT = 10;

export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  hospital: text("hospital").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  amount: integer("amount").notNull(),
  memo: text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const receiptImages = sqliteTable("receipt_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptId: integer("receipt_id")
    .notNull()
    .references(() => receipts.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: IMAGE_KINDS }).notNull(),
  path: text("path").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  time: text("time"),
  hospital: text("hospital").notNull(),
  purpose: text("purpose"),
  memo: text("memo"),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type Receipt = typeof receipts.$inferSelect;
export type ReceiptImage = typeof receiptImages.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
