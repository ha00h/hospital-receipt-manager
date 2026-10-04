"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { CATEGORIES, receipts, type Category } from "@/db/schema";
import { completeAppointmentsFor } from "@/lib/appointments";
import { requireAuth } from "@/lib/auth";
import { deleteUpload, saveUpload } from "@/lib/storage";

export type ReceiptFormState = { error?: string };

function parseFields(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const hospital = String(formData.get("hospital") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Category;
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, ""));
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜를 입력하세요." } as const;
  if (!hospital) return { error: "병원(약국) 이름을 입력하세요." } as const;
  if (!CATEGORIES.includes(category)) return { error: "구분을 선택하세요." } as const;
  if (!Number.isSafeInteger(amount) || amount <= 0) return { error: "금액을 입력하세요." } as const;

  return { data: { date, hospital, category, amount, memo } } as const;
}

function imageFrom(formData: FormData) {
  const file = formData.get("image");
  return file instanceof File && file.size > 0 ? file : null;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createReceipt(
  _prev: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  await requireAuth();
  const parsed = parseFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  let imagePath: string | null = null;
  const image = imageFrom(formData);
  if (image) {
    try {
      imagePath = await saveUpload(image);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  const row = getDb()
    .insert(receipts)
    .values({ ...parsed.data, imagePath })
    .returning({ id: receipts.id })
    .get();
  completeAppointmentsFor(parsed.data.date, parsed.data.hospital);

  revalidateAll();
  redirect(`/receipts/${row.id}`);
}

export async function updateReceipt(
  id: number,
  _prev: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  await requireAuth();
  const parsed = parseFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = getDb();
  const existing = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!existing) return { error: "영수증을 찾을 수 없습니다." };

  let imagePath = existing.imagePath;
  const image = imageFrom(formData);
  const removeImage = formData.get("removeImage") === "1";
  if (image) {
    try {
      imagePath = await saveUpload(image);
    } catch (e) {
      return { error: (e as Error).message };
    }
  } else if (removeImage) {
    imagePath = null;
  }

  db.update(receipts)
    .set({ ...parsed.data, imagePath, updatedAt: sql`(datetime('now'))` })
    .where(eq(receipts.id, id))
    .run();
  completeAppointmentsFor(parsed.data.date, parsed.data.hospital);

  if (imagePath !== existing.imagePath) await deleteUpload(existing.imagePath);

  revalidateAll();
  redirect(`/receipts/${id}`);
}

export async function deleteReceipt(id: number) {
  await requireAuth();
  const db = getDb();
  const existing = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (existing) {
    db.delete(receipts).where(eq(receipts.id, id)).run();
    await deleteUpload(existing.imagePath);
  }
  revalidateAll();
  redirect("/receipts");
}
