import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/db";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

export const UPLOAD_NAME_RE = /^[a-f0-9-]{36}\.(jpg|png|webp|heic|heif)$/;

export async function saveUpload(file: File) {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error("지원하지 않는 이미지 형식입니다.");
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(uploadPath(name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function deleteUpload(name: string | null | undefined) {
  if (!name || !UPLOAD_NAME_RE.test(name)) return;
  await fs.rm(uploadPath(name), { force: true });
}

export function uploadPath(name: string) {
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name);
}
