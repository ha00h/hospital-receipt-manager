"use client";

import imageCompression from "browser-image-compression";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ReceiptFormState } from "@/app/(main)/receipts/actions";
import type { Category, Receipt } from "@/db/schema";

type Props = {
  action: (prev: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;
  hospitals: Record<Category, string[]>;
  defaultDate: string;
  receipt?: Receipt;
};

export default function ReceiptForm({ action, hospitals, defaultDate, receipt }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    receipt?.imagePath ? `/api/uploads/${receipt.imagePath}` : null,
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [category, setCategory] = useState<Category>(receipt?.category ?? "hospital");
  const [amount, setAmount] = useState(receipt ? receipt.amount.toLocaleString("ko-KR") : "");
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCompressing(true);
    let result: File = file;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
      });
      result = new File([compressed], "receipt.jpg", { type: "image/jpeg" });
    } catch {
      // Some formats (e.g. HEIC outside Safari) can't be decoded in the browser; upload as-is.
    }
    setCompressing(false);
    setImage(result);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(result));
  }

  function submit(formData: FormData) {
    formData.delete("image");
    if (image) formData.set("image", image);
    if (removeImage) formData.set("removeImage", "1");
    formData.set("category", category);
    formAction(formData);
  }

  return (
    <form action={submit} className="space-y-4 px-4 pb-6">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="영수증 미리보기" className="max-h-80 w-full bg-slate-50 object-contain" />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setPreview(null);
                setRemoveImage(true);
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
            >
              사진 삭제
            </button>
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-slate-400">
            <CameraIcon className="h-8 w-8" />
            {compressing ? "사진 처리 중..." : "영수증 사진을 추가하세요"}
          </div>
        )}
        <div className="grid grid-cols-2 border-t border-slate-100 text-sm font-medium">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="py-3 text-brand-700 active:bg-slate-50"
          >
            사진 촬영
          </button>
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            className="border-l border-slate-100 py-3 text-slate-600 active:bg-slate-50"
          >
            앨범에서 선택
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={albumRef} type="file" accept="image/*" hidden onChange={onPick} />
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <Field label="구분">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["hospital", "병원비"],
                ["pharmacy", "약제비"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-xl border py-2.5 text-sm font-semibold ${
                  category === value
                    ? value === "hospital"
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-orange-500 bg-orange-500 text-white"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="날짜">
          <input
            type="date"
            name="date"
            required
            defaultValue={receipt?.date ?? defaultDate}
            className={inputClass}
          />
        </Field>

        <Field label={category === "pharmacy" ? "약국" : "병원"}>
          <input
            name="hospital"
            required
            list="hospital-list"
            autoComplete="off"
            defaultValue={receipt?.hospital}
            placeholder={category === "pharmacy" ? "예: 연세약국" : "예: 서울내과"}
            className={inputClass}
          />
          <datalist id="hospital-list">
            {hospitals[category].map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </Field>

        <Field label="금액">
          <div className="relative">
            <input
              name="amount"
              required
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "");
                setAmount(digits ? Number(digits).toLocaleString("ko-KR") : "");
              }}
              placeholder="0"
              className={`${inputClass} pr-10 text-right text-lg font-semibold`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">원</span>
          </div>
        </Field>

        <Field label="메모 (선택)">
          <textarea
            name="memo"
            rows={2}
            defaultValue={receipt?.memo ?? ""}
            placeholder="진료 내용 등"
            className={inputClass}
          />
        </Field>
      </section>

      {state.error && <p className="px-1 text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending || compressing}
        className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {pending ? "저장 중..." : receipt ? "수정 저장" : "영수증 저장"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
