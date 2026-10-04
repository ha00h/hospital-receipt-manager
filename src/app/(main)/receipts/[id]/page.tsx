import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryBadge from "@/components/CategoryBadge";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { IMAGE_KINDS, IMAGE_KIND_LABEL } from "@/db/schema";
import { formatWon } from "@/lib/format";
import { getReceipt, listReceiptImages } from "@/lib/receipts";
import { deleteReceipt } from "../actions";

export default async function ReceiptDetailPage({ params }: PageProps<"/receipts/[id]">) {
  await requireAuth();
  const id = Number((await params).id);
  const receipt = Number.isInteger(id) ? getReceipt(id) : undefined;
  if (!receipt) notFound();
  const images = listReceiptImages(id);

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
        {images.length > 0 ? (
          IMAGE_KINDS.filter((kind) => images.some((img) => img.kind === kind)).map((kind) => {
            const ofKind = images.filter((img) => img.kind === kind);
            return (
              <section key={kind} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 pt-3 text-sm">
                  <span className="font-semibold text-slate-700">{IMAGE_KIND_LABEL[kind]}</span>
                  {ofKind.length > 1 && <span className="text-xs text-slate-400">{ofKind.length}장</span>}
                </div>
                <div className={ofKind.length > 1 ? "grid grid-cols-2 gap-2 p-3" : "p-3"}>
                  {ofKind.map((img) => (
                    <a
                      key={img.id}
                      href={`/api/uploads/${img.path}`}
                      target="_blank"
                      className="block overflow-hidden rounded-xl bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/uploads/${img.path}`}
                        alt={IMAGE_KIND_LABEL[kind]}
                        className={
                          ofKind.length > 1 ? "aspect-[3/4] w-full object-cover" : "max-h-[60vh] w-full object-contain"
                        }
                      />
                    </a>
                  ))}
                </div>
              </section>
            );
          })
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
