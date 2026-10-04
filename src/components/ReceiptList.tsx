"use client";

import Link from "next/link";
import { useState } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import type { Category } from "@/db/schema";

export type ReceiptListItem = {
  id: number;
  date: string;
  hospital: string;
  category: Category;
  amount: number;
  thumbnail: string | null;
  photoCount: number;
};

const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

export default function ReceiptList({ rows }: { rows: ReceiptListItem[] }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const sum = rows.reduce((acc, r) => acc + r.amount, 0);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const chosen = rows.filter((r) => selected.has(r.id));
  const photoTotal = chosen.reduce((acc, r) => acc + r.photoCount, 0);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1 text-sm text-slate-500">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              className="flex items-center gap-2 font-medium text-slate-700"
            >
              <Checkbox checked={allSelected} />
              전체 선택
            </button>
            <span className="flex-1 text-right">{chosen.length}건 선택</span>
            <button type="button" onClick={exitSelecting} className="font-medium text-brand-700">
              취소
            </button>
          </>
        ) : (
          <>
            <span>{rows.length}건</span>
            <span className="flex-1 text-right">
              합계 <b className="text-base text-slate-900">{won(sum)}</b>
            </span>
            {rows.length > 0 && (
              <button type="button" onClick={() => setSelecting(true)} className="font-medium text-brand-700">
                선택
              </button>
            )}
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
          영수증이 없습니다.
          <br />
          오른쪽 아래 카메라 버튼으로 추가하세요.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
          {rows.map((r) => {
            const body = (
              <>
                {selecting && <Checkbox checked={selected.has(r.id)} />}
                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${r.thumbnail}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-slate-400">사진 없음</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 text-left">
                  <p className="text-xs text-slate-400">{r.date}</p>
                  <p className="truncate font-medium">{r.hospital}</p>
                  <CategoryBadge category={r.category} />
                </div>
                <p className="font-semibold">{won(r.amount)}</p>
              </>
            );
            const rowClass = "flex w-full items-center gap-3 px-3 py-3 active:bg-slate-50";
            return (
              <li key={r.id}>
                {selecting ? (
                  <button
                    type="button"
                    aria-pressed={selected.has(r.id)}
                    onClick={() => toggle(r.id)}
                    className={rowClass}
                  >
                    {body}
                  </button>
                ) : (
                  <Link href={`/receipts/${r.id}`} className={rowClass}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selecting ? (
        <>
          <div className="h-16" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3">
            <div className="mx-auto max-w-xl">
              {photoTotal > 0 ? (
                <a
                  href={`/api/receipts/download?ids=${chosen.map((r) => r.id).join(",")}`}
                  download
                  className="block rounded-2xl bg-brand-600 py-3.5 text-center font-semibold text-white shadow-lg"
                >
                  {allSelected ? "전체 다운로드" : "선택 다운로드"}
                  <span className="ml-1.5 text-sm font-normal opacity-80">사진 {photoTotal}장</span>
                </a>
              ) : (
                <div className="rounded-2xl bg-slate-300 py-3.5 text-center font-semibold text-white shadow-lg">
                  {chosen.length ? "고른 영수증에 사진이 없습니다" : "다운로드할 영수증을 고르세요"}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <Link
          href="/receipts/new"
          aria-label="영수증 추가"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-17rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
            <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
            <circle cx="12" cy="13.5" r="3.5" />
          </svg>
        </Link>
      )}
    </>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-bold ${
        checked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"
      }`}
    >
      {checked ? "✓" : ""}
    </span>
  );
}
