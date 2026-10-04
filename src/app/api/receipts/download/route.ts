import { isAuthenticated } from "@/lib/auth";
import { attachmentHeader, dedupeNames, imageFileNames, zipStream } from "@/lib/download";
import { todayKST } from "@/lib/format";
import { getReceipt, listReceiptImages } from "@/lib/receipts";

/** GET /api/receipts/download?ids=1,2,3 — 고른 영수증의 사진을 ZIP 하나로 내려준다. */
export async function GET(req: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });

  const ids = [
    ...new Set(
      (new URL(req.url).searchParams.get("ids") ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  const receipts = ids.map(getReceipt).filter((r) => r !== undefined);
  if (!receipts.length) return new Response("Not found", { status: 404 });

  receipts.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const entries = dedupeNames(
    receipts.flatMap((r) => imageFileNames(r, listReceiptImages(r.id))).map((e) => ({ path: e.image.path, name: e.name })),
  );
  if (!entries.length) return new Response("다운로드할 사진이 없습니다.", { status: 404 });

  const zipName =
    receipts.length === 1
      ? `${receipts[0].date}_${receipts[0].hospital.replace(/[\\/:*?"<>|]/g, "_")}.zip`
      : `영수증_${todayKST()}_${receipts.length}건.zip`;

  return new Response(zipStream(entries), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachmentHeader(zipName),
      "Cache-Control": "private, no-store",
    },
  });
}
