import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { receiptImages } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { attachmentHeader, imageFileNames } from "@/lib/download";
import { getReceipt, listReceiptImages } from "@/lib/receipts";
import { MIME_BY_EXT, uploadPath } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/images/[id]/download">) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });

  const id = Number((await ctx.params).id);
  const image = Number.isInteger(id)
    ? getDb().select().from(receiptImages).where(eq(receiptImages.id, id)).get()
    : undefined;
  const receipt = image && getReceipt(image.receiptId);
  if (!image || !receipt) return new Response("Not found", { status: 404 });

  const name = imageFileNames(receipt, listReceiptImages(receipt.id)).find((e) => e.image.id === id)!.name;
  try {
    const data = await fs.readFile(uploadPath(image.path));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_BY_EXT[image.path.split(".").pop()!] ?? "application/octet-stream",
        "Content-Disposition": attachmentHeader(name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
