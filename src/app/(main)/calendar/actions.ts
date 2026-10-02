"use server";

import { eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export type AppointmentFormState = { error?: string; ok?: number };

function parseFields(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const hospital = String(formData.get("hospital") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜를 입력하세요." } as const;
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: "시간 형식이 올바르지 않습니다." } as const;
  if (!hospital) return { error: "병원 이름을 입력하세요." } as const;
  return { data: { date, time, hospital, purpose, memo } } as const;
}

export async function saveAppointment(
  id: number | null,
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  await requireAuth();
  const parsed = parseFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = getDb();
  if (id) {
    db.update(appointments).set(parsed.data).where(eq(appointments.id, id)).run();
  } else {
    db.insert(appointments).values(parsed.data).run();
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function toggleAppointment(id: number) {
  await requireAuth();
  getDb()
    .update(appointments)
    .set({ done: not(appointments.done) })
    .where(eq(appointments.id, id))
    .run();
  revalidatePath("/", "layout");
}

export async function deleteAppointment(id: number) {
  await requireAuth();
  getDb().delete(appointments).where(eq(appointments.id, id)).run();
  revalidatePath("/", "layout");
}
