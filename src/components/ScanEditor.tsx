"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guessQuad, insetQuad, loadSource, renderScan, type Quad, type ScanMode } from "@/lib/scan";

type Props = {
  file: File;
  defaultMode: ScanMode;
  progress?: string;
  onDone: (file: File) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onCancel: () => void;
};

type Loaded = { source: HTMLCanvasElement; url: string; auto: Quad };

const LOUPE = 112;
const LOUPE_ZOOM = 2.5;

export default function ScanEditor({ file, defaultMode, progress, onDone, onSkip, onCancel }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [mode, setMode] = useState<ScanMode>(defaultMode);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(onSkip);

  useEffect(() => {
    skipRef.current = onSkip;
  });

  useEffect(() => {
    let cancelled = false;
    let url = "";
    (async () => {
      try {
        const source = await loadSource(file);
        const blob = await new Promise<Blob | null>((r) => source.toBlob(r, "image/jpeg", 0.85));
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        const auto = guessQuad(source);
        setLoaded({ source, url, auto });
        setQuad(auto);
      } catch {
        // The browser can't decode this format (e.g. HEIC outside Safari); keep the original photo.
        if (!cancelled) skipRef.current();
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const source = loaded?.source;
  const scale = source ? Math.min(box.width / source.width, box.height / source.height) : 0;
  const stageW = source ? source.width * scale : 0;
  const stageH = source ? source.height * scale : 0;

  function moveCorner(index: number, e: React.PointerEvent) {
    if (!source || !stageRef.current || !quad) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(source.width, Math.max(0, (e.clientX - rect.left) / scale));
    const y = Math.min(source.height, Math.max(0, (e.clientY - rect.top) / scale));
    const next = [...quad] as Quad;
    next[index] = { x, y };
    setQuad(next);
  }

  async function finish() {
    if (!source || !quad) return;
    setBusy(true);
    try {
      await onDone(await renderScan(source, quad, mode));
    } finally {
      setBusy(false);
    }
  }

  const points = quad?.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const active = dragging !== null && points ? points[dragging] : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="py-1 text-sm text-slate-300">
          빼기
        </button>
        <p className="text-sm font-semibold">
          문서 영역 맞추기{progress && <span className="ml-1.5 font-normal text-slate-400">{progress}</span>}
        </p>
        <button type="button" onClick={() => onSkip()} disabled={busy} className="py-1 text-sm text-slate-300">
          원본 사용
        </button>
      </div>

      <div ref={areaRef} className="relative mx-4 flex-1 touch-none">
        {loaded && points ? (
          <div
            ref={stageRef}
            className="absolute"
            style={{
              width: stageW,
              height: stageH,
              left: (box.width - stageW) / 2,
              top: (box.height - stageH) / 2,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={loaded.url} alt="" draggable={false} className="h-full w-full select-none" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <mask id="scan-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(2,6,23,0.55)" mask="url(#scan-mask)" />
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth={2}
              />
            </svg>
            {points.map((p, i) => (
              <div
                key={i}
                role="slider"
                aria-label={`${["왼쪽 위", "오른쪽 위", "오른쪽 아래", "왼쪽 아래"][i]} 모서리`}
                aria-valuenow={Math.round(p.x)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDragging(i);
                }}
                onPointerMove={(e) => dragging === i && moveCorner(i, e)}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)}
                className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: p.x, top: p.y }}
              >
                <span className="h-5 w-5 rounded-full border-2 border-white bg-teal-400/80 shadow" />
              </div>
            ))}
            {active && (
              <div
                className="pointer-events-none absolute overflow-hidden rounded-full border-2 border-white shadow-lg"
                style={{
                  width: LOUPE,
                  height: LOUPE,
                  left: (stageW - LOUPE) / 2,
                  top: active.y < stageH / 2 ? stageH - LOUPE : 0,
                  backgroundImage: `url(${loaded.url})`,
                  backgroundSize: `${stageW * LOUPE_ZOOM}px ${stageH * LOUPE_ZOOM}px`,
                  backgroundPosition: `${LOUPE / 2 - active.x * LOUPE_ZOOM}px ${LOUPE / 2 - active.y * LOUPE_ZOOM}px`,
                }}
              >
                <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-300" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">사진 불러오는 중...</div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex rounded-full bg-white/10 p-0.5">
            {(
              [
                ["scan", "스캔"],
                ["color", "원본 색"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-3.5 py-1.5 ${mode === value ? "bg-white font-semibold text-slate-900" : "text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-slate-300">
            <button type="button" disabled={!loaded} onClick={() => loaded && setQuad(loaded.auto)}>
              자동 맞춤
            </button>
            <button
              type="button"
              disabled={!source}
              onClick={() => source && setQuad(insetQuad(source.width, source.height, 0))}
            >
              전체
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={finish}
          disabled={!quad || busy}
          className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold disabled:opacity-60"
        >
          {busy ? "처리 중..." : "완료"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
