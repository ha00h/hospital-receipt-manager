import "server-only";
import { and, asc, desc, eq, getTableColumns, gte, like, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { receiptImages, receipts, type Category } from "@/db/schema";

export type ReceiptFilter = {
  month?: string;
  category?: Category;
  q?: string;
};

export function listReceipts(filter: ReceiptFilter) {
  const conds = [];
  if (filter.month) conds.push(like(receipts.date, `${filter.month}-%`));
  if (filter.category) conds.push(eq(receipts.category, filter.category));
  if (filter.q) conds.push(like(receipts.hospital, `%${filter.q}%`));
  return getDb()
    .select({
      ...getTableColumns(receipts),
      thumbnail: sql<string | null>`(
        select ri.path from receipt_images ri
        where ri.receipt_id = "receipts"."id" and ri.kind = 'receipt'
        order by ri.position, ri.id limit 1
      )`,
    })
    .from(receipts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(receipts.date), desc(receipts.id))
    .all();
}

export function getReceipt(id: number) {
  return getDb().select().from(receipts).where(eq(receipts.id, id)).get();
}

export function listReceiptImages(receiptId: number) {
  return getDb()
    .select()
    .from(receiptImages)
    .where(eq(receiptImages.receiptId, receiptId))
    .orderBy(asc(receiptImages.position), asc(receiptImages.id))
    .all();
}

export function listHospitalNames(category: Category) {
  return getDb()
    .select({ hospital: receipts.hospital })
    .from(receipts)
    .where(eq(receipts.category, category))
    .groupBy(receipts.hospital)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${receipts.date})`), asc(receipts.hospital))
    .all()
    .map((r) => r.hospital);
}

export function listHospitalNamesByCategory(): Record<Category, string[]> {
  return { hospital: listHospitalNames("hospital"), pharmacy: listHospitalNames("pharmacy") };
}

export function listReceiptMonths() {
  return getDb()
    .selectDistinct({ month: sql<string>`substr(${receipts.date}, 1, 7)` })
    .from(receipts)
    .orderBy(desc(sql`substr(${receipts.date}, 1, 7)`))
    .all()
    .map((r) => r.month);
}

export type Totals = { total: number; hospital: number; pharmacy: number; count: number };

export function getTotals(from?: string, to?: string): Totals {
  const conds = [];
  if (from) conds.push(gte(receipts.date, from));
  if (to) conds.push(lte(receipts.date, to));
  const row = getDb()
    .select({
      total: sql<number>`coalesce(sum(${receipts.amount}), 0)`,
      hospital: sql<number>`coalesce(sum(case when ${receipts.category} = 'hospital' then ${receipts.amount} end), 0)`,
      pharmacy: sql<number>`coalesce(sum(case when ${receipts.category} = 'pharmacy' then ${receipts.amount} end), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(receipts)
    .where(conds.length ? and(...conds) : undefined)
    .get();
  return row ?? { total: 0, hospital: 0, pharmacy: 0, count: 0 };
}

export function getMonthlyTotals(fromMonth: string, toMonth: string) {
  return getDb()
    .select({
      month: sql<string>`substr(${receipts.date}, 1, 7)`.as("month"),
      hospital: sql<number>`coalesce(sum(case when ${receipts.category} = 'hospital' then ${receipts.amount} end), 0)`,
      pharmacy: sql<number>`coalesce(sum(case when ${receipts.category} = 'pharmacy' then ${receipts.amount} end), 0)`,
    })
    .from(receipts)
    .where(and(gte(receipts.date, `${fromMonth}-01`), lte(receipts.date, `${toMonth}-31`)))
    .groupBy(sql`month`)
    .all();
}

export function getTopHospitals(limit: number, from?: string, to?: string) {
  const conds = [];
  if (from) conds.push(gte(receipts.date, from));
  if (to) conds.push(lte(receipts.date, to));
  return getDb()
    .select({
      hospital: receipts.hospital,
      amount: sql<number>`sum(${receipts.amount})`.as("amount"),
      count: sql<number>`count(*)`,
    })
    .from(receipts)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(receipts.hospital)
    .orderBy(desc(sql`amount`))
    .limit(limit)
    .all();
}
