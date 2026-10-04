"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  CATEGORIES,
  IMAGE_KINDS,
  MAX_IMAGES_PER_RECEIPT,
  receiptImages,
  receipts,
  type Category,
  type ImageKind,
} from "@/db/schema";
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

function newImagesFrom(formData: FormData) {
  return IMAGE_KINDS.flatMap((kind) =>
    formData
      .getAll(`image:${kind}`)
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map((file) => ({ kind, file })),
  );
}

async function saveImages(images: { kind: ImageKind; file: File }[]) {
  const saved: { kind: ImageKind; path: string }[] = [];
  try {
    for (const { kind, file } of images) saved.push({ kind, path: await saveUpload(file) });
  } catch (e) {
    await Promise.all(saved.map((s) => deleteUpload(s.path)));
    throw e;
  }
  return saved;
}

function insertImages(receiptId: number, saved: { kind: ImageKind; path: string }[]) {
  if (!saved.length) return;
  const db = getDb();
  const start =
    db
      .select({ max: sql<number | null>`max(${receiptImages.position})` })
      .from(receiptImages)
      .where(eq(receiptImages.receiptId, receiptId))
      .get()?.max ?? -1;
  db.insert(receiptImages)
    .values(saved.map((s, i) => ({ receiptId, kind: s.kind, path: s.path, position: start + 1 + i })))
    .run();
}

const tooManyImages = `사진은 영수증 하나에 ${MAX_IMAGES_PER_RECEIPT}장까지 올릴 수 있습니다.`;

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

  const images = newImagesFrom(formData);
  if (images.length > MAX_IMAGES_PER_RECEIPT) return { error: tooManyImages };

  let saved;
  try {
    saved = await saveImages(images);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const row = getDb().insert(receipts).values(parsed.data).returning({ id: receipts.id }).get();
  insertImages(row.id, saved);
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

  const current = db.select().from(receiptImages).where(eq(receiptImages.receiptId, id)).all();
  const removeIds = new Set(formData.getAll("removeImageId").map(Number));
  const removed = current.filter((img) => removeIds.has(img.id));
  const images = newImagesFrom(formData);
  if (current.length - removed.length + images.length > MAX_IMAGES_PER_RECEIPT) {
    return { error: tooManyImages };
  }

  let saved;
  try {
    saved = await saveImages(images);
  } catch (e) {
    return { error: (e as Error).message };
  }

  db.update(receipts)
    .set({ ...parsed.data, updatedAt: sql`(datetime('now'))` })
    .where(eq(receipts.id, id))
    .run();
  if (removed.length) {
    db.delete(receiptImages)
      .where(and(eq(receiptImages.receiptId, id), inArray(receiptImages.id, removed.map((r) => r.id))))
      .run();
  }
  insertImages(id, saved);
  completeAppointmentsFor(parsed.data.date, parsed.data.hospital);

  await Promise.all(removed.map((r) => deleteUpload(r.path)));

  revalidateAll();
  redirect(`/receipts/${id}`);
}

export async function deleteReceipt(id: number) {
  await requireAuth();
  const db = getDb();
  const images = db.select().from(receiptImages).where(eq(receiptImages.receiptId, id)).all();
  db.delete(receiptImages).where(eq(receiptImages.receiptId, id)).run();
  db.delete(receipts).where(eq(receipts.id, id)).run();
  await Promise.all(images.map((img) => deleteUpload(img.path)));
  revalidateAll();
  redirect("/receipts");
}
