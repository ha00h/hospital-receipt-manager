"use client";

import imageCompression from "browser-image-compression";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ReceiptFormState } from "@/app/(main)/receipts/actions";
import { readReceiptLocally } from "@/lib/ocrReceipt";
import type { ReceiptRead } from "@/lib/receiptRead";
import ScanEditor from "@/components/ScanEditor";
import {
  IMAGE_KINDS,
  IMAGE_KIND_LABEL,
  MAX_IMAGES_PER_RECEIPT,
  type Category,
  type ImageKind,
  type Receipt,
  type ReceiptImage,
} from "@/db/schema";

type Props = {
  action: (prev: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;
  hospitals: Record<Category, string[]>;
  defaultDate: string;
  receipt?: Receipt;
  images?: ReceiptImage[];
};

type PendingImage = { key: string; kind: ImageKind; file: File; url: string };
type ExtraKind = Exclude<ImageKind, "receipt">;

const EXTRA_KINDS = IMAGE_KINDS.filter((k): k is ExtraKind => k !== "receipt");
// 서버 액션 요청 한도(15MB)보다 여유 있게 막는다.
const MAX_UPLOAD_BYTES = 14 * 1024 * 1024;

async function compress(file: File) {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return new File([compressed], "image.jpg", { type: "image/jpeg" });
  } catch {
    // Some formats (e.g. HEIC outside Safari) can't be decoded in the browser; upload as-is.
    return file;
  }
}

export default function ReceiptForm({ action, hospitals, defaultDate, receipt, images = [] }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [newImages, setNewImages] = useState<PendingImage[]>([]);
  const [openExtras, setOpenExtras] = useState<ExtraKind[]>([]);
  const [promptDismissed, setPromptDismissed] = useState(Boolean(receipt));
  const [compressingKind, setCompressingKind] = useState<ImageKind | null>(null);
  const compressing = compressingKind !== null;
  const [clientError, setClientError] = useState<string | null>(null);
  const [scanQueue, setScanQueue] = useState<{ kind: ImageKind; files: File[]; total: number } | null>(null);
  const [category, setCategory] = useState<Category>(receipt?.category ?? "hospital");
  const [date, setDate] = useState(receipt?.date ?? defaultDate);
  const [hospital, setHospital] = useState(receipt?.hospital ?? "");
  const [amount, setAmount] = useState(receipt ? receipt.amount.toLocaleString("ko-KR") : "");
  const [reading, setReading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [readNote, setReadNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const edited = useRef({
    date: Boolean(receipt),
    hospital: Boolean(receipt),
    amount: Boolean(receipt),
    category: Boolean(receipt),
  });
  const readSeq = useRef(0);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const kept = images.filter((img) => !removedIds.includes(img.id));
  const total = kept.length + newImages.length;
  const remaining = MAX_IMAGES_PER_RECEIPT - total;
  const countOf = (kind: ImageKind) =>
    kept.filter((i) => i.kind === kind).length + newImages.filter((i) => i.kind === kind).length;
  const isVisible = (kind: ImageKind) =>
    kind === "receipt" || openExtras.includes(kind as ExtraKind) || countOf(kind) > 0;
  const hiddenExtras = EXTRA_KINDS.filter((k) => !isVisible(k));

  function onPick(kind: ImageKind, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setClientError(files.length > remaining ? `사진은 ${MAX_IMAGES_PER_RECEIPT}장까지 올릴 수 있습니다.` : null);
    const accepted = files.slice(0, Math.max(remaining, 0));
    if (accepted.length) setScanQueue({ kind, files: accepted, total: accepted.length });
  }

  function nextScan() {
    setScanQueue((q) => (q && q.files.length > 1 ? { ...q, files: q.files.slice(1) } : null));
  }

  async function addImage(kind: ImageKind, file: File, compressed = false) {
    setCompressingKind(kind);
    const result = compressed ? file : await compress(file);
    const url = URL.createObjectURL(result);
    urlsRef.current.push(url);
    setNewImages((prev) => [...prev, { key: url, kind, file: result, url }]);
    setCompressingKind(null);
  }

  async function readChosen(file: File, onProgress: (ratio: number) => void) {
    onProgress(0.04);
    const compressed = await compress(file);
    onProgress(0.08);
    await readIntoForm(compressed, false, onProgress);
    return compressed;
  }

  function applyRead(fields: ReceiptRead, force: boolean) {
    const nextCategory = fields.category && (force || !edited.current.category) ? fields.category : category;
    const place = nextCategory === "pharmacy" ? "약국" : "병원";
    let filled = 0;
    const missed: string[] = [];

    if (fields.category && (force || !edited.current.category)) {
      setCategory(fields.category);
      edited.current.category = true;
      filled += 1;
    }
    if (!fields.date) missed.push("날짜");
    else if (force || !edited.current.date) {
      setDate(fields.date);
      edited.current.date = true;
      filled += 1;
    }
    if (!fields.hospital) missed.push(place);
    else if (force || !edited.current.hospital) {
      setHospital(fields.hospital);
      edited.current.hospital = true;
      filled += 1;
    }
    if (!fields.amount) missed.push("금액");
    else if (force || !edited.current.amount) {
      setAmount(fields.amount.toLocaleString("ko-KR"));
      edited.current.amount = true;
      filled += 1;
    }
    return { filled, missed };
  }

  async function sourceForRead() {
    const pending = [...newImages].reverse();
    const found = pending.find((img) => img.kind === "receipt") ?? pending.find((img) => img.kind === "detail");
    if (found) return found.file;
    const saved = [...kept].reverse();
    const image = saved.find((img) => img.kind === "receipt") ?? saved.find((img) => img.kind === "detail");
    if (!image) return null;
    const response = await fetch(`/api/uploads/${image.path}`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], "receipt.jpg", { type: blob.type || "image/jpeg" });
  }

  async function readIntoForm(file: File, force: boolean, onProgress?: (ratio: number) => void) {
    const seq = ++readSeq.current;
    setReading(true);
    setReadProgress(0);
    setReadNote(null);
    const report = (ratio: number) => {
      setReadProgress((prev) => Math.max(prev, ratio));
      onProgress?.(ratio);
    };
    try {
      const result = await readReceiptLocally(file, hospitals, report);
      if (seq !== readSeq.current) return;
      const { filled, missed } = applyRead(result, force);
      if (filled === 0) {
        setReadNote({ tone: "info", text: "이미 입력한 내용은 바꾸지 않았어요." });
      } else if (missed.length) {
        setReadNote({ tone: "info", text: `사진에서 읽어 채웠어요. 찾지 못한 칸: ${missed.join(", ")}.` });
      } else {
        setReadNote({ tone: "info", text: "사진에서 읽어 채웠어요. 맞는지 확인해 주세요." });
      }
    } catch (error) {
      if (seq !== readSeq.current) return;
      setReadNote({
        tone: "error",
        text: error instanceof Error ? error.message : "영수증을 읽지 못했어요. 다시 시도해 주세요.",
      });
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }

  async function readLatest() {
    const file = await sourceForRead();
    if (!file) {
      setReadNote({ tone: "error", text: "읽을 영수증 사진이 없습니다." });
      return;
    }
    await readIntoForm(file, true);
  }

  function removeNew(key: string) {
    URL.revokeObjectURL(key);
    setNewImages((prev) => prev.filter((i) => i.key !== key));
  }

  function submit(formData: FormData) {
    const bytes = newImages.reduce((sum, i) => sum + i.file.size, 0);
    if (bytes > MAX_UPLOAD_BYTES) {
      setClientError("사진 용량이 너무 큽니다. 몇 장을 빼고 저장한 뒤, 수정 화면에서 나머지를 추가해 주세요.");
      return;
    }
    setClientError(null);
    for (const img of newImages) formData.append(`image:${img.kind}`, img.file);
    for (const id of removedIds) formData.append("removeImageId", String(id));
    formData.set("category", category);
    formAction(formData);
  }

  return (
    <form action={submit} className="space-y-4 px-4 pb-6">
      {IMAGE_KINDS.filter(isVisible).map((kind) => {
        const keptOfKind = kept.filter((i) => i.kind === kind);
        const newOfKind = newImages.filter((i) => i.kind === kind);
        const empty = keptOfKind.length + newOfKind.length === 0;
        return (
          <section key={kind} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pt-3 text-sm">
              <span className="font-semibold text-slate-700">{IMAGE_KIND_LABEL[kind]}</span>
              {!empty && <span className="text-xs text-slate-400">{keptOfKind.length + newOfKind.length}장</span>}
            </div>
            {empty ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-sm text-slate-400">
                <CameraIcon className="h-8 w-8" />
                {compressingKind === kind ? "사진 처리 중..." : `${IMAGE_KIND_LABEL[kind]} 사진을 추가하세요`}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-3">
                {keptOfKind.map((img) => (
                  <Thumb
                    key={img.id}
                    src={`/api/uploads/${img.path}`}
                    onRemove={() => setRemovedIds((prev) => [...prev, img.id])}
                  />
                ))}
                {newOfKind.map((img) => (
                  <Thumb key={img.key} src={img.url} onRemove={() => removeNew(img.key)} />
                ))}
                {compressingKind === kind && (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
                    처리 중...
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 border-t border-slate-100 text-sm font-medium">
              <PhotoPicker kind={kind} source="camera" disabled={remaining <= 0 || compressing} onPick={onPick} />
              <PhotoPicker kind={kind} source="album" disabled={remaining <= 0 || compressing} onPick={onPick} />
            </div>
          </section>
        );
      })}

      {countOf("receipt") > 0 &&
        hiddenExtras.length > 0 &&
        (promptDismissed ? (
          <div className="flex justify-center gap-4 text-sm text-slate-500">
            {hiddenExtras.map((k) => (
              <button key={k} type="button" onClick={() => setOpenExtras((p) => [...p, k])}>
                + {IMAGE_KIND_LABEL[k]} 추가
              </button>
            ))}
          </div>
        ) : (
          <section className="rounded-2xl bg-brand-50 p-4 text-sm">
            <p className="font-medium text-slate-700">세부내역서나 다른 사진도 올릴까요?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenExtras.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOpenExtras((p) => [...p, k])}
                  className="rounded-full bg-brand-600 px-3.5 py-1.5 font-semibold text-white"
                >
                  + {IMAGE_KIND_LABEL[k]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPromptDismissed(true)}
                className="rounded-full bg-white px-3.5 py-1.5 text-slate-500"
              >
                괜찮아요
              </button>
            </div>
          </section>
        ))}

      {countOf("receipt") + countOf("detail") > 0 && (
        <div className="text-center">
          <button
            type="button"
            disabled={reading || compressing}
            onClick={() => void readLatest()}
            className="text-sm font-medium text-brand-700 disabled:text-slate-300"
          >
            {reading ? "영수증을 읽는 중..." : "사진에서 날짜·병원·금액 읽기"}
          </button>
        </div>
      )}

      {scanQueue && (
        <ScanEditor
          key={`${scanQueue.total - scanQueue.files.length}-${scanQueue.files[0].name}-${scanQueue.files[0].lastModified}`}
          file={scanQueue.files[0]}
          defaultMode={scanQueue.kind === "other" ? "color" : "scan"}
          progress={
            scanQueue.total > 1 ? `${scanQueue.total - scanQueue.files.length + 1}/${scanQueue.total}` : undefined
          }
          onRead={scanQueue.kind === "other" ? undefined : readChosen}
          onDone={async (file, compressed) => {
            await addImage(scanQueue.kind, file, Boolean(compressed));
            nextScan();
          }}
          onSkip={async () => {
            const { kind, files } = scanQueue;
            nextScan();
            await addImage(kind, files[0]);
          }}
          onCancel={nextScan}
        />
      )}

      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        {(reading || readNote) && (
          <div className="space-y-2">
            {reading && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(readProgress * 100)}
                aria-label="글자 인식 진행률"
                className="h-1.5 overflow-hidden rounded-full bg-brand-100"
              >
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                  style={{ width: `${Math.max(4, Math.round(readProgress * 100))}%` }}
                />
              </div>
            )}
            <p className={reading || readNote?.tone === "info" ? "text-sm text-brand-700" : "text-sm text-red-600"}>
              {reading ? `영수증을 읽는 중... ${Math.round(readProgress * 100)}%` : readNote?.text}
            </p>
          </div>
        )}

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
                onClick={() => {
                  edited.current.category = true;
                  setCategory(value);
                }}
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
            value={date}
            onChange={(e) => {
              edited.current.date = true;
              setDate(e.target.value);
            }}
            className={inputClass}
          />
        </Field>

        <Field label={category === "pharmacy" ? "약국" : "병원"}>
          <input
            name="hospital"
            required
            list="hospital-list"
            autoComplete="off"
            value={hospital}
            onChange={(e) => {
              edited.current.hospital = true;
              setHospital(e.target.value);
            }}
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
                edited.current.amount = true;
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

      {(clientError ?? state.error) && <p className="px-1 text-sm text-red-600">{clientError ?? state.error}</p>}

      <button
        disabled={pending || compressing || reading}
        className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {pending ? "저장 중..." : receipt ? "수정 저장" : "영수증 저장"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-brand-500";

function PhotoPicker({
  kind,
  source,
  disabled,
  onPick,
}: {
  kind: ImageKind;
  source: "camera" | "album";
  disabled: boolean;
  onPick: (kind: ImageKind, event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const camera = source === "camera";
  return (
    <label
      className={`relative block py-3 text-center active:bg-slate-50 ${camera ? "" : "border-l border-slate-100"} ${
        disabled ? "text-slate-300" : camera ? "text-brand-700" : "text-slate-600"
      }`}
    >
      {camera ? "사진 촬영" : "앨범에서 선택"}
      {/* iOS는 숨긴 입력을 스크립트로 누르면 카메라가 열리지 않는다. 탭이 입력에 직접 닿게 둔다. */}
      <input
        type="file"
        accept="image/*"
        capture={camera ? "environment" : undefined}
        multiple={!camera}
        disabled={disabled}
        className="absolute inset-0 h-full w-full opacity-0 disabled:pointer-events-none"
        onChange={(event) => onPick(kind, event)}
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="사진 삭제"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
      >
        ✕
      </button>
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
