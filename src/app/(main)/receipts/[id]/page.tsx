import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryBadge from "@/components/CategoryBadge";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { formatWon } from "@/lib/format";
import { getReceipt } from "@/lib/receipts";
import { deleteReceipt } from "../actions";

export default async function ReceiptDetailPage({ params }: PageProps<"/receipts/[id]">) {
  await requireAuth();
  const id = Number((await params).id);
  const receipt = Number.isInteger(id) ? getReceipt(id) : undefined;
  if (!receipt) notFound();

  return (
    <>
      <PageHeader
        title="영수증 상세"
        backHref="/receipts"
        right={
          <Link href={`/receipts/${id}/edit`} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700">
            수정
          </Link>
        }
      />
      <div className="space-y-4 px-4 pb-6">
        {receipt.imagePath ? (
          <a
            href={`/api/uploads/${receipt.imagePath}`}
            target="_blank"
            className="block overflow-hidden rounded-2xl bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/uploads/${receipt.imagePath}`}
              alt="영수증"
              className="max-h-[60vh] w-full bg-slate-50 object-contain"
            />
            <p className="py-2 text-center text-xs text-slate-400">탭하면 원본 크기로 볼 수 있어요</p>
          </a>
        ) : (
          <div className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm">
            등록된 사진이 없습니다.
          </div>
        )}

        <dl className="divide-y divide-slate-100 rounded-2xl bg-white px-4 shadow-sm">
          <Row label="금액">
            <span className="text-xl font-bold">{formatWon(receipt.amount)}</span>
          </Row>
          <Row label="구분">
            <CategoryBadge category={receipt.category} />
          </Row>
          <Row label="날짜">{receipt.date}</Row>
          <Row label={receipt.category === "pharmacy" ? "약국" : "병원"}>{receipt.hospital}</Row>
          {receipt.memo && <Row label="메모">{receipt.memo}</Row>}
        </dl>

        <form action={deleteReceipt.bind(null, id)}>
          <ConfirmSubmit
            message="이 영수증을 삭제할까요?"
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-red-600 shadow-sm"
          >
            삭제
          </ConfirmSubmit>
        </form>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
