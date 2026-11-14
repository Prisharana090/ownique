"use client";
// Try It On: a product mockup made entirely in your browser (no AI, nothing uploaded).
// Upload a product photo, place the design (drag, resize, rotate, perspective corners), then Create Preview.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { renderMockup, type Blend, type Pt } from "@/lib/mockup";
import { detectProduct } from "@/lib/productMask";
import { TEMPLATES, type ProductTemplate } from "@/lib/templates";
import { DEFAULT_COLORS, customizeArt, isCustomized, type ColorSettings } from "@/lib/artColor";
import DesignColors from "./DesignColors";

type D = { _id: string; title: string; status: string; imageHash?: string };
type Place = { c: Pt; w: number; rot: number; off: Pt[] }; // photo pixels; off = per-corner perspective offsets (× width)
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const LABEL = "Product mockup—final appearance may vary.";
const AI_LABEL = "AI-generated preview—details and final appearance may vary.";
const BLENDS: [Blend, string][] = [
  ["multiply", "Multiply (printed look)"], ["source-over", "Normal"], ["overlay", "Overlay"],
  ["soft-light", "Soft light"], ["screen", "Screen (light products)"], ["darken", "Darken"],
];
const ZERO = (): Pt[] => [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => fail(new Error("load"));
  i.src = src;
});

export default function TryOn() {
  const params = useSearchParams();
  const [designs, setDesigns] = useState<D[]>([]);
  const [designId, setDesignId] = useState(params.get("design") ?? "");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [opacity, setOpacity] = useState(90);
  const [blend, setBlend] = useState<Blend>("multiply");
  const [result, setResult] = useState<{ url: string; original: string; designId: string; thumb?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [colors, setColors] = useState<ColorSettings>(DEFAULT_COLORS);
  // The artwork actually drawn: the watermarked preview with the user's preview-only color changes.
  const artView = useMemo(() => (art ? customizeArt(art, colors) : null), [art, colors]);
  const [ai, setAi] = useState<{ available: boolean; remaining: number; provider?: "gemini" | "cloudflare" | null } | null>(null);
  const [aiResult, setAiResult] = useState<{ url: string; original: string; designId: string; thumb?: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: "move" | "corner" | "rotate" | "resize" | "vertex"; i?: number; p0: Pt; s0: Place } | null>(null);
  // Print area: an outline of the product surface (photo pixels). The design is clipped to it everywhere.
  const [area, setArea] = useState<Pt[]>([]);
  const [areaMode, setAreaMode] = useState<"off" | "draw" | "edit">("off");
  // Automatic product detection (on by default): the design can never leave the product.
  const [autoOn, setAutoOn] = useState(true);
  const [template, setTemplate] = useState<ProductTemplate | null>(null);
  const [curve, setCurve] = useState(0); // 0-100: wrap around round products
  const [sensitivity, setSensitivity] = useState(30);
  const [showArea, setShowArea] = useState(false);
  const product = useMemo(() => (photo ? detectProduct(photo, sensitivity) : null), [photo, sensitivity]);
  /** The allowed print region as a mask canvas: detected product ∩ hand-drawn outline (either may be absent). */
  const allowed = useMemo(() => {
    if (!photo) return null;
    const useAuto = autoOn && product?.ok;
    const useArea = area.length >= 3 && areaMode !== "draw";
    if (!useAuto && !useArea) return null;
    const base = useAuto ? product!.canvas : null;
    const c = document.createElement("canvas");
    c.width = base?.width ?? Math.round(Math.min(1, 320 / Math.max(photo.naturalWidth, photo.naturalHeight)) * photo.naturalWidth);
    c.height = base?.height ?? Math.round(Math.min(1, 320 / Math.max(photo.naturalWidth, photo.naturalHeight)) * photo.naturalHeight);
    const x = c.getContext("2d")!;
    if (base) x.drawImage(base, 0, 0);
    else { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
    if (useArea) {
      const sx = c.width / photo.naturalWidth, sy = c.height / photo.naturalHeight;
      x.globalCompositeOperation = "destination-in";
      x.beginPath();
      area.forEach((p, i) => (i ? x.lineTo(p.x * sx, p.y * sy) : x.moveTo(p.x * sx, p.y * sy)));
      x.closePath();
      x.fillStyle = "#fff";
      x.fill();
    }
    return c;
  }, [photo, product, autoOn, area, areaMode]);
  const mask = () => allowed ?? undefined;
  // Pink tint over everything OUTSIDE the allowed region (only when "Show print area" is on).
  const areaOverlay = useMemo(() => {
    if (!showArea || !allowed) return null;
    const c = document.createElement("canvas");
    c.width = allowed.width; c.height = allowed.height;
    const x = c.getContext("2d")!;
    x.fillStyle = "rgba(196,108,141,0.45)";
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-out";
    x.drawImage(allowed, 0, 0);
    return c.toDataURL();
  }, [showArea, allowed]);

  // Designs list; carry over ?design= from the design page.
  useEffect(() => {
    fetch("/api/designs").then((r) => r.json()).then((data) => {
      const list: D[] = data.designs ?? [];
      setDesigns(list);
      setDesignId((cur) => (cur && list.some((d) => d._id === cur) ? cur : list[0]?._id ?? ""));
    }).catch(() => setError("Couldn't load designs. Please refresh."));
    fetch("/api/try-on/ai").then((r) => r.json()).then(setAi).catch(() => setAi({ available: false, remaining: 0 }));
  }, []);

  // Watermarked preview artwork only (same origin, so the canvas can export it). Never the private original.
  useEffect(() => {
    setArt(null);
    setColors(DEFAULT_COLORS);
    if (!designId) return;
    const v = designs.find((d) => d._id === designId)?.imageHash?.slice(0, 8);
    loadImg(`/api/designs/${designId}/image${v ? `?v=${v}` : ""}`).then(setArt).catch(() => setError("Couldn't load that design's preview."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, designs.length]);

  // Start (or reset) the placement when the photo or artwork changes.
  const reset = useCallback(() => {
    if (!photo || !art) return;
    if (template) {
      // Centre the design in the template's print area, filling most of its width.
      const xs = template.area.map((p) => p.x), ys = template.area.map((p) => p.y);
      const sx = photo.naturalWidth / 1000, sy = photo.naturalHeight / 1000;
      const bw = (Math.max(...xs) - Math.min(...xs)) * sx, bh = (Math.max(...ys) - Math.min(...ys)) * sy;
      const w = Math.min(bw * 0.8, (bh * 0.8 * art.naturalWidth) / art.naturalHeight);
      setPlace({ c: { x: ((Math.max(...xs) + Math.min(...xs)) / 2) * sx, y: ((Math.max(...ys) + Math.min(...ys)) / 2) * sy }, w, rot: 0, off: ZERO() });
      return;
    }
    setPlace({ c: { x: photo.naturalWidth / 2, y: photo.naturalHeight / 2 }, w: photo.naturalWidth * 0.35, rot: 0, off: ZERO() });
  }, [photo, art, template]);
  useEffect(reset, [reset]);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [photo]);

  const corners = useCallback((p: Place): Pt[] => {
    if (!art) return [];
    const h = p.w * (art.naturalHeight / art.naturalWidth);
    const base = [{ x: -p.w / 2, y: -h / 2 }, { x: p.w / 2, y: -h / 2 }, { x: p.w / 2, y: h / 2 }, { x: -p.w / 2, y: h / 2 }];
    const r = (p.rot * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
    return base.map((b, i) => {
      const lx = b.x + p.off[i].x * p.w, ly = b.y + p.off[i].y * p.w;
      return { x: p.c.x + lx * cos - ly * sin, y: p.c.y + lx * sin + ly * cos };
    });
  }, [art]);

  // Live preview (screen resolution).
  useEffect(() => {
    if (!photo || !art || !artView || !place || !canvas.current || !boxW) return;
    const id = requestAnimationFrame(() => {
      const k = (boxW * (window.devicePixelRatio || 1)) / photo.naturalWidth;
      try {
        renderMockup(canvas.current!, photo, artView, corners(place).map((q) => ({ x: q.x * k, y: q.y * k })),
          photo.naturalWidth * k, photo.naturalHeight * k, { opacity: opacity / 100, blend, grid: 12, mask: mask(), feather: 1.5 * (window.devicePixelRatio || 1), curve: curve / 100 });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preview failed.");
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, art, artView, place, opacity, blend, boxW, corners, allowed, curve]);

  async function pickFile(f: File | null, tpl: ProductTemplate | null = null) {
    setError(null);
    setResult(null);
    setAiResult(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Please choose a JPG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setError("Photo must be under 10MB.");
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImg(url);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhoto(img);
      setPhotoUrl(url);
      setPhotoFile(f);
      setTemplate(tpl);
      // Built-in templates come with their print area and surface curve; uploads use automatic detection.
      setArea(tpl ? tpl.area.map((p) => ({ x: (p.x * img.naturalWidth) / 1000, y: (p.y * img.naturalHeight) / 1000 })) : []);
      setAreaMode("off");
      setAutoOn(!tpl);
      setCurve(tpl ? Math.round(tpl.curve * 100) : 0);
    } catch {
      URL.revokeObjectURL(url);
      setError("That file couldn't be opened as an image. Try another photo.");
    }
  }

  async function pickTemplate(t: ProductTemplate) {
    try {
      const blob = await (await fetch(t.src)).blob();
      await pickFile(new File([blob], `${t.id}.jpg`, { type: "image/jpeg" }), t);
    } catch {
      setError("Couldn't load that product template.");
    }
  }

  // Pointer → photo pixels
  const toPhoto = (e: React.PointerEvent): Pt => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * photo!.naturalWidth, y: ((e.clientY - r.top) / r.height) * photo!.naturalHeight };
  };
  const begin = (mode: "move" | "corner" | "rotate" | "resize", i?: number) => (e: React.PointerEvent) => {
    if (!place) return;
    e.stopPropagation();
    e.preventDefault();
    drag.current = { mode, i, p0: toPhoto(e), s0: { ...place, c: { ...place.c }, off: place.off.map((o) => ({ ...o })) } };
    box.current?.setPointerCapture(e.pointerId);
  };
  function onBoxDown(e: React.PointerEvent) {
    if (areaMode === "draw" && photo) setArea((a) => [...a, toPhoto(e)]);
  }
  const beginVertex = (i: number) => (e: React.PointerEvent) => {
    if (!place) return;
    e.stopPropagation();
    e.preventDefault();
    drag.current = { mode: "vertex", i, p0: toPhoto(e), s0: place };
    box.current?.setPointerCapture(e.pointerId);
  };
  function onMove(e: React.PointerEvent) {
    const g = drag.current;
    if (!g || !photo) return;
    const p = toPhoto(e), s = g.s0;
    if (g.mode === "vertex" && g.i !== undefined) {
      const clamp = { x: Math.min(photo.naturalWidth, Math.max(0, p.x)), y: Math.min(photo.naturalHeight, Math.max(0, p.y)) };
      setArea((a) => a.map((v, j) => (j === g.i ? clamp : v)));
      return;
    }
    const ang = (q: Pt) => Math.atan2(q.y - s.c.y, q.x - s.c.x);
    if (g.mode === "move") setPlace({ ...s, c: { x: s.c.x + p.x - g.p0.x, y: s.c.y + p.y - g.p0.y } });
    if (g.mode === "rotate") setPlace({ ...s, rot: s.rot + ((ang(p) - ang(g.p0)) * 180) / Math.PI });
    if (g.mode === "resize") {
      const f = Math.hypot(p.x - s.c.x, p.y - s.c.y) / Math.max(1, Math.hypot(g.p0.x - s.c.x, g.p0.y - s.c.y));
      setPlace({ ...s, w: Math.max(photo.naturalWidth * 0.03, Math.min(photo.naturalWidth * 3, s.w * f)) });
    }
    if (g.mode === "corner" && g.i !== undefined && art) {
      // Move one corner: convert the pointer back into the design's own (unrotated) frame.
      const r = (-s.rot * Math.PI) / 180, dx = p.x - s.c.x, dy = p.y - s.c.y;
      const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
      const h = s.w * (art.naturalHeight / art.naturalWidth);
      const bx = (g.i === 1 || g.i === 2 ? 1 : -1) * (s.w / 2), by = (g.i >= 2 ? 1 : -1) * (h / 2);
      const off = s.off.map((o, j) => (j === g.i ? { x: (lx - bx) / s.w, y: (ly - by) / s.w } : o));
      setPlace({ ...s, off });
    }
  }

  async function createPreview() {
    if (!photo || !art || !artView || !place || !photoUrl) return;
    setBusy(true);
    setError(null);
    try {
      // Full resolution (capped at 2400px on the long side so phones don't run out of memory).
      const k = Math.min(1, 2400 / Math.max(photo.naturalWidth, photo.naturalHeight));
      const out = document.createElement("canvas");
      renderMockup(out, photo, artView, corners(place).map((q) => ({ x: q.x * k, y: q.y * k })),
        photo.naturalWidth * k, photo.naturalHeight * k, { opacity: opacity / 100, blend, grid: 24, mask: mask(), feather: 2, curve: curve / 100 });
      const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, "image/jpeg", 0.92));
      if (!blob) throw new Error("Couldn't create the preview.");
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(blob), original: photoUrl, designId, thumb: isCustomized(colors) ? artView.toDataURL("image/png") : undefined });
      fetch("/api/try-on", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId }) }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the preview. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Optional: Cloudflare Workers AI makes a realistic version from the photo, the watermarked art and our mockup. */
  async function aiPreview(file: File | null) {
    if (!file || !photo || !art || !artView || !place || !photoUrl || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const k = Math.min(1, 512 / Math.max(photo.naturalWidth, photo.naturalHeight));
      const g = document.createElement("canvas");
      renderMockup(g, photo, artView, corners(place).map((p) => ({ x: p.x * k, y: p.y * k })), photo.naturalWidth * k, photo.naturalHeight * k, { opacity: opacity / 100, blend, grid: 16, mask: mask(), feather: 1, curve: curve / 100 });
      const guide = await new Promise<Blob | null>((ok) => g.toBlob(ok, "image/jpeg", 0.9));
      if (!guide) throw new Error("Couldn't prepare the mockup.");
      const form = new FormData();
      form.append("product", file);
      form.append("guide", guide, "guide.jpg");
      form.append("designId", designId);
      // Where the AI result is allowed to show: the print area, or (if none) the design's own outline.
      const mk = Math.min(1, 1024 / Math.max(photo.naturalWidth, photo.naturalHeight));
      // AI pixels are only kept where the design sits AND inside the allowed print region (white on black).
      const mw = Math.round(photo.naturalWidth * mk), mh = Math.round(photo.naturalHeight * mk);
      const mc = document.createElement("canvas");
      mc.width = mw; mc.height = mh;
      const mx = mc.getContext("2d")!;
      const quad = corners(place).map((p) => ({ x: p.x * mk, y: p.y * mk }));
      mx.fillStyle = "#fff";
      mx.strokeStyle = "#fff";
      mx.lineWidth = Math.max(4, mw * 0.03); // a little room around the design for shading
      mx.beginPath();
      quad.forEach((p, i) => (i ? mx.lineTo(p.x, p.y) : mx.moveTo(p.x, p.y)));
      mx.closePath();
      mx.fill();
      mx.stroke();
      if (allowed) {
        mx.globalCompositeOperation = "destination-in";
        mx.drawImage(allowed, 0, 0, mw, mh);
      }
      mx.globalCompositeOperation = "destination-over";
      mx.fillStyle = "#000";
      mx.fillRect(0, 0, mw, mh);
      const maskBlob = await new Promise<Blob | null>((ok) => mc.toBlob(ok, "image/png"));
      if (maskBlob) form.append("mask", maskBlob, "mask.png");
      // Send the customized (recolored / background-hidden) artwork, still watermarked, when the user changed it.
      if (isCustomized(colors)) {
        const custom = await new Promise<Blob | null>((ok) => artView.toBlob(ok, "image/png"));
        if (custom) form.append("artwork", custom, "artwork.png");
      }
      const res = await fetch("/api/try-on/ai", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.image) throw new Error(data.error || "The AI preview couldn't be created.");
      setAiResult({ url: data.image, original: photoUrl, designId, thumb: isCustomized(colors) ? artView.toDataURL("image/png") : undefined });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The AI preview couldn't be created.");
    } finally {
      setAiBusy(false);
      fetch("/api/try-on/ai").then((r) => r.json()).then(setAi).catch(() => {});
    }
  }

  const q = place && art ? corners(place) : [];
  const nw = photo?.naturalWidth ?? 1, nh = photo?.naturalHeight ?? 1;
  // Handles stay inside the photo even when the design hangs off the edge, so they can always be grabbed.
  const clampPct = (v: number) => Math.min(100, Math.max(0, v));
  const pct = (p: Pt) => ({ left: `${clampPct((p.x / nw) * 100)}%`, top: `${clampPct((p.y / nh) * 100)}%` });
  const handleOffset = (from: Pt, to: Pt, px: number) => { // a point `px` screen pixels beyond `to`, away from `from`
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1, scale = boxW ? nw / boxW : 1;
    return { x: to.x + ((to.x - from.x) / len) * px * scale, y: to.y + ((to.y - from.y) / len) * px * scale };
  };
  const topMid = q.length ? { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 } : null;
  const step = "font-serif text-lg font-semibold text-violet-900";
  const handle = "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-300 bg-white text-xs text-violet-700 shadow touch-none";
  const selected = designs.find((d) => d._id === designId);
  // Versioned preview URL so changed artwork never shows a stale cached picture.
  const previewUrl = (id: string) => {
    const v = designs.find((d) => d._id === id)?.imageHash?.slice(0, 8);
    return `/api/designs/${id}/image${v ? `?v=${v}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl font-semibold text-violet-900">Try It On</h1>
        <p className="text-stone-600">See a design on your own cup, vase, shirt or anything else before you buy. Everything happens in your browser.</p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-[#ece3d9] bg-white/80 p-5 shadow-sm sm:grid-cols-2">
        <label className="block">
          <span className={step}>1. Upload a photo or pick a free product</span>
          <input type="file" accept="image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-violet-100 file:px-4 file:py-2 file:font-semibold file:text-violet-800 hover:file:bg-violet-200"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <span className="mt-1 block text-xs text-stone-500">JPG, PNG or WebP, up to 10MB. Your photo never leaves your device.</span>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-500">Or try a plain product</span>
          <span className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => pickTemplate(t)} aria-pressed={template?.id === t.id} title={t.name}
                className={`overflow-hidden rounded-xl border bg-white text-[11px] text-stone-700 ${template?.id === t.id ? "border-violet-500 ring-2 ring-violet-200" : "border-stone-200 hover:border-violet-300"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt="" className="aspect-square w-full object-cover" />
                <span className="block truncate px-1 py-1">{t.name}</span>
              </button>
            ))}
          </span>
        </label>
        <label className="block">
          <span className={step}>2. Choose a design</span>
          <div className="mt-2 flex items-center gap-3">
            {designId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl(designId)} alt="" className="h-12 w-12 rounded-xl border border-stone-200 object-cover" />
            )}
            <select value={designId} onChange={(e) => { setDesignId(e.target.value); setResult(null); }}
              className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2">
              {designs.length === 0 && <option value="">No designs yet</option>}
              {designs.map((d) => <option key={d._id} value={d._id}>{d.title}{d.status === "sold" ? " (owned)" : ""}</option>)}
            </select>
          </div>
        </label>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        <h2 className={step}>3. Place the design</h2>
        <p className="text-sm text-stone-500">Drag to move. ⟳ rotates, ⤡ resizes, and the four corner dots tilt the perspective.</p>
        <div className="mx-auto max-w-xl">
          {!photo ? (
            <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 text-center text-stone-400">
              Upload a product photo to start
            </div>
          ) : (
            <div ref={box} onPointerDown={onBoxDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
              style={{ aspectRatio: `${nw} / ${nh}` }} className={`relative w-full touch-none select-none overflow-visible ${areaMode === "draw" ? "cursor-crosshair" : ""}`}>
              <canvas ref={canvas} className="absolute inset-0 h-full w-full rounded-2xl border border-stone-200" aria-label="Live mockup preview" />
              {q.length === 4 && areaMode !== "draw" && (
                <>
                  <svg viewBox={`0 0 ${nw} ${nh}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-hidden rounded-2xl">
                    <polygon points={q.map((p) => `${p.x},${p.y}`).join(" ")} onPointerDown={begin("move")}
                      fill="transparent" stroke="#7c3aed" strokeWidth={Math.max(1, nw / 400)} strokeDasharray={`${nw / 80} ${nw / 120}`}
                      style={{ cursor: "move", pointerEvents: "all" }} />
                  </svg>
                  {q.map((p, i) => (
                    <span key={i} onPointerDown={begin("corner", i)} aria-label={`Perspective corner ${i + 1}`}
                      className={`${handle} h-5 w-5 cursor-crosshair bg-violet-600`} style={pct(p)} />
                  ))}
                  {topMid && place && (
                    <span onPointerDown={begin("rotate")} aria-label="Rotate" className={`${handle} cursor-grab`}
                      style={pct(handleOffset(place.c, topMid, 30))}>⟳</span>
                  )}
                  {place && (
                    <span onPointerDown={begin("resize")} aria-label="Resize" className={`${handle} cursor-nwse-resize`}
                      style={pct(handleOffset(place.c, q[2], 26))}>⤡</span>
                  )}
                </>
              )}
              {areaOverlay && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={areaOverlay} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl" />
              )}
              {area.length > 0 && (
                <svg viewBox={`0 0 ${nw} ${nh}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden rounded-2xl">
                  {areaMode === "draw" && area.length < 3
                    ? <polyline points={area.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#c46c8d" strokeWidth={Math.max(1.5, nw / 300)} />
                    : <polygon points={area.map((p) => `${p.x},${p.y}`).join(" ")} fill={areaMode === "off" ? "none" : "rgba(196,108,141,0.15)"}
                        stroke="#c46c8d" strokeWidth={Math.max(1.5, nw / 300)} strokeDasharray={areaMode === "off" ? `${nw / 60} ${nw / 90}` : undefined} />}
                </svg>
              )}
              {areaMode !== "off" && area.map((p, i) => (
                <span key={`v${i}`} onPointerDown={areaMode === "edit" ? beginVertex(i) : undefined} aria-label={`Print area point ${i + 1}`}
                  className={`${handle} h-4 w-4 border-[#c46c8d] bg-[#e9b2c6] ${areaMode === "edit" ? "cursor-move" : "pointer-events-none"}`} style={pct(p)} />
              ))}
            </div>
          )}

          {photo && (
            <div className="mt-3 space-y-2 rounded-2xl border border-[#ece3d9] bg-white/80 p-3 text-sm">
              <p className="font-medium text-stone-800">Print area {allowed && areaMode !== "draw" ? <span className="text-xs font-normal text-emerald-700">✓ the design can&apos;t leave it</span> : null}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} />
                Detect the product automatically
                {autoOn && product && (product.ok
                  ? <span className="text-xs text-stone-500">(found it)</span>
                  : <span className="text-xs text-red-700">(couldn&apos;t find its edges: adjust sensitivity or outline it below)</span>)}
              </label>
              {autoOn && (
                <label className="block text-xs text-stone-600">Edge sensitivity: {sensitivity}
                  <input type="range" min={5} max={70} value={sensitivity} onChange={(e) => setSensitivity(+e.target.value)} className="block w-full accent-violet-600" />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} disabled={!allowed} />
                Show print area (pink = blocked)
              </label>
              <p className="text-xs text-stone-500">
                {areaMode === "draw"
                  ? `Tap around the edge of the surface to print on (for a hoodie: just the front panel). ${area.length} point${area.length === 1 ? "" : "s"} so far.`
                  : areaMode === "edit" ? "Drag the pink points to adjust the outline."
                  : "Optional: outline a smaller part (for a hoodie, just the front panel) to keep the design off hands, the hood or seams."}
              </p>
              <div className="flex flex-wrap gap-2">
                {areaMode === "draw" ? (
                  <>
                    <button type="button" onClick={() => setAreaMode("off")} disabled={area.length < 3} className="rounded-full bg-violet-700 px-4 py-1.5 font-semibold text-white disabled:opacity-40">Finish outline</button>
                    <button type="button" onClick={() => setArea((a) => a.slice(0, -1))} disabled={!area.length} className="rounded-full border border-stone-300 bg-white px-4 py-1.5 disabled:opacity-40">Undo point</button>
                    <button type="button" onClick={() => { setArea([]); setAreaMode("off"); }} className="rounded-full border border-stone-300 bg-white px-4 py-1.5">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setArea([]); setAreaMode("draw"); }} className="rounded-full border border-violet-300 bg-white px-4 py-1.5 font-semibold text-violet-800">
                      {area.length >= 3 ? "Redraw print area" : "Outline print area"}
                    </button>
                    {area.length >= 3 && (
                      <>
                        <button type="button" onClick={() => setAreaMode(areaMode === "edit" ? "off" : "edit")} className="rounded-full border border-stone-300 bg-white px-4 py-1.5">{areaMode === "edit" ? "Done adjusting" : "Adjust outline"}</button>
                        <button type="button" onClick={() => { setArea([]); setAreaMode("off"); }} className="rounded-full border border-stone-300 bg-white px-4 py-1.5">Remove print area</button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {art && <DesignColors art={art} preview={artView} value={colors} onChange={setColors} />}

          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <label>Surface curve: {curve}%
              <input type="range" min={0} max={100} value={curve} onChange={(e) => setCurve(+e.target.value)} className="block w-full accent-violet-600" aria-describedby="curve-help" />
              <span id="curve-help" className="block text-xs text-stone-500">Wraps the design around round products like mugs, cans and pots.</span>
            </label>
            <label>Opacity: {opacity}%
              <input type="range" min={20} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="block w-full accent-violet-600" />
            </label>
            <label>Blending
              <select value={blend} onChange={(e) => setBlend(e.target.value as Blend)} className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2">
                {BLENDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={createPreview} disabled={!photo || !art || !place || busy}
              className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
              {busy ? "Creating preview…" : "Create Preview"}
            </button>
            <button onClick={reset} disabled={!photo || !art}
              className="rounded-full border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-40">
              Reset placement
            </button>
          </div>
        </div>
      </section>

      {result && <Compare thumbUrl={previewUrl(result.designId)} r={result} title="After · Manual mockup" kind="manual" label={LABEL} download selected={selected} />}

      <section className="space-y-3 rounded-3xl border border-violet-200 bg-violet-50/50 p-5">
        <h2 className={step}>5. Optional: Generate AI Preview</h2>
        <p className="text-sm text-stone-600">
          This sends your product photo, the design&apos;s watermarked preview and your mockup (placement, size, rotation and colors)
          to {ai?.provider === "gemini" ? "Google Gemini" : ai?.provider === "cloudflare" ? "Cloudflare Workers AI" : "an AI image service"} to create a
          more realistic image. Ownique keeps everything outside the print area exactly as in your photo and doesn&apos;t save the images.
          Don&apos;t upload photos of other people without their permission.
        </p>
        {ai && !ai.available && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">AI Try-On isn&apos;t available right now. Your manual mockup above still works.</p>}
        {ai?.available && <p className="text-xs text-stone-500">AI previews left today (whole site): {ai.remaining}</p>}
        <button onClick={() => aiPreview(photoFile)} disabled={!photoFile || !place || aiBusy || !ai?.available || ai.remaining <= 0}
          className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
          {aiBusy ? "Generating AI preview… (up to a minute)" : aiError ? "Try again" : "Generate AI Preview"}
        </button>
        {aiError && !aiBusy && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{aiError}</p>}
      </section>

      {aiResult && <Compare thumbUrl={previewUrl(aiResult.designId)} r={aiResult} title="After · AI preview" kind="ai" label={AI_LABEL} selected={selected} />}
    </div>
  );
}

function Compare({ r, title, kind, label, download, selected, thumbUrl }: {
  r: { url: string; original: string; designId: string; thumb?: string }; title: string; kind: "manual" | "ai"; label: string; download?: boolean; selected?: D; thumbUrl: string;
}) {
  return (
    <section className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <figure className="space-y-2">
          <figcaption className="text-sm font-semibold text-stone-600">Before</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.original} alt="Your original product photo" className="w-full rounded-2xl border border-stone-200 bg-white object-contain" />
        </figure>
        <figure className="space-y-2">
          <figcaption className="flex items-center gap-2 text-sm font-semibold text-violet-800">
            {title}
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${kind === "ai" ? "bg-fuchsia-100 text-fuchsia-800" : "bg-violet-100 text-violet-800"}`}>
              {kind === "ai" ? "✨ AI-generated" : "Manual mockup · no AI"}
            </span>
          </figcaption>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.url} alt={title} className="w-full rounded-2xl border border-violet-200 bg-white object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.thumb ?? thumbUrl} alt={`Selected design${selected ? `: ${selected.title}` : ""}`}
              className="absolute right-3 top-3 h-14 w-14 rounded-xl border-2 border-white bg-[conic-gradient(#eee_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:12px_12px] object-contain shadow-md sm:h-16 sm:w-16" />
          </div>
        </figure>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        {download && <a href={r.url} download="ownique-mockup.jpg" className="text-xs font-semibold text-violet-700 underline">Download mockup</a>}
      </div>
    </section>
  );
}
