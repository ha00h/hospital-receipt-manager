"use client";

import { useActionState, useEffect, useState } from "react";
import { saveAppointment, type AppointmentFormState } from "@/app/(main)/calendar/actions";
import type { Appointment } from "@/db/schema";

type Props = {
  defaultDate: string;
  appointment?: Appointment;
  hospitals: string[];
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
};

export default function AppointmentSheet({
  defaultDate,
  appointment,
  hospitals,
  trigger,
  triggerClassName,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label={triggerLabel}>
        {trigger}
      </button>
      {open && (
        <Sheet
          defaultDate={defaultDate}
          appointment={appointment}
          hospitals={hospitals}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Sheet({
  defaultDate,
  appointment,
  hospitals,
  onClose,
}: Omit<Props, "trigger" | "triggerClassName" | "triggerLabel"> & { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<AppointmentFormState, FormData>(
    saveAppointment.bind(null, appointment?.id ?? null),
    {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <form
        action={formAction}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{appointment ? "예약 수정" : "예약 추가"}</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400">
            닫기
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            name="date"
            required
            defaultValue={appointment?.date ?? defaultDate}
            className={inputClass}
          />
          <input type="time" name="time" defaultValue={appointment?.time ?? ""} className={inputClass} />
        </div>
        <input
          name="hospital"
          required
          list="appt-hospitals"
          autoComplete="off"
          placeholder="병원 이름"
          defaultValue={appointment?.hospital}
          className={inputClass}
        />
        <datalist id="appt-hospitals">
          {hospitals.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <input
          name="purpose"
          placeholder="진료 목적 (예: 정기검진)"
          defaultValue={appointment?.purpose ?? ""}
          className={inputClass}
        />
        <textarea
          name="memo"
          rows={2}
          placeholder="메모 (준비물 등)"
          defaultValue={appointment?.memo ?? ""}
          className={inputClass}
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-2xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-brand-500";
