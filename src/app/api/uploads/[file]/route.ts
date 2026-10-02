import fs from "node:fs/promises";
import { isAuthenticated } from "@/lib/auth";
import { MIME_BY_EXT, UPLOAD_NAME_RE, uploadPath } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[file]">) {
  if (!(await isAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { file } = await ctx.params;
  if (!UPLOAD_NAME_RE.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(uploadPath(file));
    const ext = file.split(".").pop()!;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
