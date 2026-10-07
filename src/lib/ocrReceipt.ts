import type { Category } from "@/db/schema";
import { parseReceiptOcr, type ReceiptRead } from "@/lib/receiptRead";

type OcrWorker = {
  recognize: (image: File) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<OcrWorker> | null = null;
let chain: Promise<unknown> = Promise.resolve();
let reportProgress: ((ratio: number) => void) | null = null;

/** Recognizes a receipt photo in the browser. The image is not uploaded. */
export function readReceiptLocally(
  file: File,
  known: Record<Category, string[]>,
  onProgress?: (ratio: number) => void,
): Promise<ReceiptRead> {
  const run = chain.then(() => recognize(file, known, onProgress));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function recognize(
  file: File,
  known: Record<Category, string[]>,
  onProgress?: (ratio: number) => void,
): Promise<ReceiptRead> {
  let worker: OcrWorker | null = null;
  try {
    reportProgress = onProgress ?? null;
    worker = await getWorker();
    const result = await worker.recognize(file);
    const fields = parseReceiptOcr(result.data.text, known);
    if (!fields.date && !fields.hospital && !fields.amount) {
      throw new Error("사진에서 날짜, 기관, 금액을 찾지 못했어요.");
    }
    return fields;
  } catch (error) {
    if (error instanceof Error && /찾지 못했/.test(error.message)) throw error;
    workerPromise = null;
    await worker?.terminate().catch(() => undefined);
    throw new Error("영수증을 읽지 못했어요. 다시 시도해 주세요.");
  } finally {
    reportProgress = null;
  }
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

async function createOcrWorker(): Promise<OcrWorker> {
  const Tesseract = await import("tesseract.js");
  const origin = window.location.origin;
  const worker = await Tesseract.createWorker("kor+eng", 1, {
    workerPath: `${origin}/tesseract/worker.min.js`,
    corePath: `${origin}/tesseract/core`,
    langPath: `${origin}/tesseract/lang`,
    logger(message) {
      const ratio =
        message.status === "recognizing text" ? 0.15 + message.progress * 0.85 : Math.min(0.14, message.progress * 0.14);
      reportProgress?.(ratio);
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
  });
  return worker;
}
