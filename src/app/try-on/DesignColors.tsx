"use client";
// "Design color" and "Hide design background" controls for Try It On (preview-only customization).
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_COLORS, cornerColor, isHex, palette, rgbToHex, type ColorSettings } from "@/lib/artColor";

const PRESETS = ["#000000", "#ffffff", "#7c3aed", "#652f52", "#e9b2c6", "#e11d48", "#f97316", "#16a34a", "#0ea5e9", "#1e3a8a"];

function Swatch({ color, active, onClick, label }: { color: string; active?: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} title={label ?? color} aria-label={label ?? `Color ${color}`}
      className={`h-7 w-7 shrink-0 rounded-full border shadow-sm ${active ? "ring-2 ring-violet-600 ring-offset-2" : "border-stone-300"}`}
      style={{ background: color }} />
  );
}

function HexField({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <span className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`}
        className="h-8 w-10 cursor-pointer rounded border border-stone-300 bg-white" />
      <input value={text} maxLength={7} aria-label={`${label} HEX`} spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (isHex(e.target.value)) onChange(("#" + e.target.value.replace("#", "")).toLowerCase());
        }}
        className={`w-24 rounded-lg border px-2 py-1 font-mono text-sm ${isHex(text) ? "border-stone-300" : "border-red-400"}`} />
    </span>
  );
}

export default function DesignColors({ art, preview, value, onChange }: {
  art: HTMLImageElement; preview: HTMLCanvasElement | null; value: ColorSettings; onChange: (s: ColorSettings) => void;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const [pick, setPick] = useState<"source" | "bg" | null>(null);
  const original = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = art.naturalWidth; c.height = art.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(art, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  }, [art]);
  const colorsInArt = useMemo(() => palette(original), [original]);
  const set = (p: Partial<ColorSettings>) => onChange({ ...value, ...p });

  // Live view of the customized artwork (checkerboard shows transparency).
  useEffect(() => {
    const v = view.current;
    if (!v || !preview) return;
    v.width = preview.width; v.height = preview.height;
    v.getContext("2d")!.drawImage(preview, 0, 0);
  }, [preview]);

  // Eyedropper: sample the ORIGINAL artwork color under the click.
  function sample(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!pick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * original.width), y = Math.floor(((e.clientY - r.top) / r.height) * original.height);
    const i = (Math.min(original.height - 1, Math.max(0, y)) * original.width + Math.min(original.width - 1, Math.max(0, x))) * 4;
    const hex = rgbToHex({ r: original.data[i], g: original.data[i + 1], b: original.data[i + 2] });
    set(pick === "source" ? { source: hex, mode: "replace" } : { bg: hex, hideBg: true });
    setPick(null);
  }

  const mode = (m: ColorSettings["mode"], label: string) => (
    <button type="button" onClick={() => set({ mode: m })}
      className={`rounded-full border px-3 py-1.5 text-sm ${value.mode === m ? "border-violet-500 bg-violet-100 font-semibold text-violet-900" : "border-stone-300 bg-white text-stone-700"}`}>
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-[#ece3d9] bg-white/80 p-4">
      <div className="flex items-start gap-4">
        <canvas ref={view} onClick={sample} aria-label="Customized design preview"
          className={`h-24 w-24 shrink-0 rounded-xl border border-stone-200 bg-[conic-gradient(#eee_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:16px_16px] object-contain ${pick ? "cursor-crosshair ring-2 ring-violet-500" : ""}`} />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-serif text-base font-semibold text-violet-900">Design color</p>
          <p className="text-xs text-stone-500">Preview only: the designer&apos;s original file and listing don&apos;t change, and the watermark stays.</p>
          {pick && <p className="text-xs font-semibold text-violet-700">Tap the design to pick the {pick === "source" ? "color to replace" : "background color"}.</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {mode("none", "Original colors")}
        {mode("tint", "Recolor whole design")}
        {mode("replace", "Replace one color")}
      </div>

      {value.mode !== "none" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">{value.mode === "replace" ? "New color" : "Color"}</p>
          <div className="flex flex-wrap gap-2">{PRESETS.map((c) => <Swatch key={c} color={c} active={value.target === c} onClick={() => set({ target: c })} />)}</div>
          <HexField label="Design color" value={value.target} onChange={(hex) => set({ target: hex })} />
        </div>
      )}

      {value.mode === "replace" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">Color to replace</p>
          <div className="flex flex-wrap items-center gap-2">
            {colorsInArt.map((c) => <Swatch key={c} color={c} label={`Replace ${c}`} active={value.source === c} onClick={() => set({ source: c })} />)}
            <button type="button" onClick={() => setPick(pick === "source" ? null : "source")} className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-800">🎯 Pick from design</button>
          </div>
          <HexField label="Color to replace" value={value.source} onChange={(hex) => set({ source: hex })} />
          <label className="block text-sm">Tolerance: {value.tolerance}
            <input type="range" min={2} max={60} value={value.tolerance} onChange={(e) => set({ tolerance: +e.target.value })} className="block w-full accent-violet-600" />
          </label>
        </div>
      )}

      <div className="space-y-2 border-t border-stone-100 pt-3">
        <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={value.hideBg}
            onChange={(e) => set(e.target.checked ? { hideBg: true, bg: value.bg === DEFAULT_COLORS.bg ? cornerColor(original) : value.bg } : { hideBg: false })} />
          Hide design background
        </label>
        {value.hideBg && (
          <>
            <p className="text-xs text-stone-500">Best for designs on a flat, single-color background.</p>
            <div className="flex flex-wrap items-center gap-2">
              <HexField label="Background color" value={value.bg} onChange={(hex) => set({ bg: hex })} />
              <button type="button" onClick={() => setPick(pick === "bg" ? null : "bg")} className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-800">🎯 Pick from design</button>
            </div>
            <label className="block text-sm">Removal tolerance: {value.bgTolerance}
              <input type="range" min={1} max={50} value={value.bgTolerance} onChange={(e) => set({ bgTolerance: +e.target.value })} className="block w-full accent-violet-600" />
            </label>
          </>
        )}
      </div>

      <button type="button" onClick={() => { setPick(null); onChange(DEFAULT_COLORS); }}
        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
        Reset colors
      </button>
    </div>
  );
}
