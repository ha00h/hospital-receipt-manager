import "server-only";
import fs from "node:fs/promises";
import { Zip, ZipPassThrough } from "fflate";
import { IMAGE_KIND_LABEL, type Receipt, type ReceiptImage } from "@/db/schema";
import { uploadPath } from "@/lib/storage";

function safeSegment(s: string) {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "이름없음";
}

function extOf(path: string) {
  return path.slice(path.lastIndexOf(".") + 1);
}

/** 날짜_기관명_종류(_번호).확장자 — 같은 종류가 여러 장일 때만 번호를 붙인다. */
export function imageFileNames(receipt: Receipt, images: ReceiptImage[]) {
  const totalByKind = new Map<string, number>();
  for (const img of images) totalByKind.set(img.kind, (totalByKind.get(img.kind) ?? 0) + 1);
  const seenByKind = new Map<string, number>();
  return images.map((image) => {
    const n = (seenByKind.get(image.kind) ?? 0) + 1;
    seenByKind.set(image.kind, n);
    const suffix = (totalByKind.get(image.kind) ?? 0) > 1 ? `_${n}` : "";
    const name = `${receipt.date}_${safeSegment(receipt.hospital)}_${IMAGE_KIND_LABEL[image.kind]}${suffix}.${extOf(image.path)}`;
    return { image, name };
  });
}

/** ZIP 안에서 이름이 겹치면 확장자 앞에 _2, _3 …을 붙인다. */
export function dedupeNames<T extends { name: string }>(entries: T[]) {
  const used = new Set<string>();
  return entries.map((entry) => {
    let name = entry.name;
    const dot = name.lastIndexOf(".");
    for (let i = 2; used.has(name); i++) name = `${entry.name.slice(0, dot)}_${i}${entry.name.slice(dot)}`;
    used.add(name);
    return { ...entry, name };
  });
}

export function attachmentHeader(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** 사진은 이미 JPEG로 압축돼 있어 무압축(STORE)으로 한 장씩 읽어 스트리밍한다. */
export function zipStream(entries: { path: string; name: string }[]) {
  let index = 0;
  let zip: Zip;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
    },
    async pull() {
      while (index < entries.length) {
        const { path, name } = entries[index++];
        const data = await fs.readFile(uploadPath(path)).catch(() => null);
        if (!data) continue;
        const file = new ZipPassThrough(name);
        zip.add(file);
        file.push(new Uint8Array(data), true);
        return;
      }
      zip.end();
    },
  });
}
