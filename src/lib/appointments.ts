import "server-only";
import { and, asc, eq, gte, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments } from "@/db/schema";

const order = [
  asc(appointments.date),
  sql`${appointments.time} is null`,
  asc(appointments.time),
  asc(appointments.id),
];

export function listAppointmentsInMonth(month: string) {
  return getDb()
    .select()
    .from(appointments)
    .where(like(appointments.date, `${month}-%`))
    .orderBy(...order)
    .all();
}

export function listUpcomingAppointments(fromDate: string, limit: number) {
  return getDb()
    .select()
    .from(appointments)
    .where(and(gte(appointments.date, fromDate), eq(appointments.done, false)))
    .orderBy(...order)
    .limit(limit)
    .all();
}

export function completeAppointmentsFor(date: string, hospital: string) {
  getDb()
    .update(appointments)
    .set({ done: true })
    .where(
      and(eq(appointments.date, date), eq(sql`trim(${appointments.hospital})`, hospital), eq(appointments.done, false)),
    )
    .run();
}

export function getAppointment(id: number) {
  return getDb().select().from(appointments).where(eq(appointments.id, id)).get();
}
