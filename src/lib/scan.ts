export type Point = { x: number; y: number };
/** Corners in source-image pixels, ordered top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];
export type ScanMode = "scan" | "color";

const MAX_SOURCE_SIDE = 2400;
const MAX_OUTPUT_SIDE = 2000;
const DETECT_SIDE = 256;

/** Decodes the file with EXIF orientation applied, downscaled so phones don't run out of canvas memory. */
export async function loadSource(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export function insetQuad(width: number, height: number, ratio = 0.08): Quad {
  const dx = width * ratio;
  const dy = height * ratio;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/**
 * Guesses where the paper is: the largest bright region after Otsu thresholding.
 * Falls back to a slightly inset frame when the region is implausibly small.
 */
export function guessQuad(source: HTMLCanvasElement): Quad {
  const scale = Math.min(1, DETECT_SIDE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const g = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    gray[i] = g;
    hist[g]++;
  }
  const threshold = otsu(hist, w * h);

  const labels = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let best: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (labels[start] !== -1 || gray[start] <= threshold) continue;
    const pixels: number[] = [];
    let top = 0;
    stack[top++] = start;
    labels[start] = start;
    while (top > 0) {
      const p = stack[--top];
      pixels.push(p);
      const x = p % w;
      const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const n of neighbors) {
        if (n < 0 || n >= w * h || labels[n] !== -1 || gray[n] <= threshold) continue;
        labels[n] = start;
        stack[top++] = n;
      }
    }
    if (pixels.length > best.length) best = pixels;
  }

  if (best.length < w * h * 0.08) return insetQuad(source.width, source.height);

  let tl = best[0], tr = best[0], br = best[0], bl = best[0];
  const sum = (p: number) => (p % w) + Math.floor(p / w);
  const diff = (p: number) => (p % w) - Math.floor(p / w);
  for (const p of best) {
    if (sum(p) < sum(tl)) tl = p;
    if (sum(p) > sum(br)) br = p;
    if (diff(p) > diff(tr)) tr = p;
    if (diff(p) < diff(bl)) bl = p;
  }
  const toSource = (p: number): Point => ({
    x: Math.min(source.width, ((p % w) + 0.5) / scale),
    y: Math.min(source.height, (Math.floor(p / w) + 0.5) / scale),
  });
  const corners = [toSource(tl), toSource(tr), toSource(br), toSource(bl)];
  const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
  const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
  // Pull corners slightly inward so a sliver of background doesn't survive the crop.
  const quad = corners.map((p) => ({ x: p.x + (cx - p.x) * 0.015, y: p.y + (cy - p.y) * 0.015 })) as Quad;
  return quadArea(quad) < source.width * source.height * 0.08 ? insetQuad(source.width, source.height) : quad;
}

/** Straightens the quad into a rectangle and optionally makes it look like a scanned page. */
export async function renderScan(source: HTMLCanvasElement, quad: Quad, mode: ScanMode): Promise<File> {
  const [tl, tr, br, bl] = quad;
  let outW = Math.max(dist(tl, tr), dist(bl, br));
  let outH = Math.max(dist(tl, bl), dist(tr, br));
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * scale));
  outH = Math.max(1, Math.round(outH * scale));

  const src = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, source.width, source.height);
  const out = new ImageData(outW, outH);
  const H = homography(
    [
      { x: 0, y: 0 },
      { x: outW, y: 0 },
      { x: outW, y: outH },
      { x: 0, y: outH },
    ],
    quad,
  );
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  const o = out.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = H[6] * px + H[7] * py + 1;
      const sx = Math.min(sw - 1.001, Math.max(0, (H[0] * px + H[1] * py + H[2]) / d - 0.5));
      const sy = Math.min(sh - 1.001, Math.max(0, (H[3] * px + H[4] * py + H[5]) / d - 0.5));
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const oi = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * fx;
        const bottom = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * fx;
        o[oi + c] = top + (bottom - top) * fy;
      }
      o[oi + 3] = 255;
    }
  }
  if (mode === "scan") whitenPaper(out);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext("2d")!.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("이미지를 만들지 못했습니다.");
  return new File([blob], "scan.jpg", { type: "image/jpeg" });
}

/** Divides by a blurred copy so uneven lighting and shadows turn into white paper with dark text. */
function whitenPaper(img: ImageData) {
  const { width: w, height: h, data } = img;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
  }
  const integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 24));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const bg =
        (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]) /
        area;
      const ratio = gray[y * w + x] / Math.max(bg, 1);
      const v = Math.max(0, Math.min(255, ((ratio - 0.55) / (0.95 - 0.55)) * 255));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
}

function otsu(hist: Uint32Array, total: number) {
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumBg = 0;
  let weightBg = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (!weightBg) continue;
    const weightFg = total - weightBg;
    if (!weightFg) break;
    sumBg += t * hist[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const between = weightBg * weightFg * (meanBg - meanFg) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function quadArea(q: Quad) {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Projective transform mapping each `from` point onto the matching `to` point. */
function homography(from: Point[], to: Point[]) {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const f = A[row][col] / A[col][col];
      for (let k = col; k < 9; k++) A[row][k] -= f * A[col][k];
    }
  }
  return A.map((row, i) => row[8] / A[i][i]);
}
