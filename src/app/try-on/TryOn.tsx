"use client";
// Try It On: upload a photo of your product, place a design by hand (drag, resize, rotate),
// then ask Gemini to apply it to the product. Photo uploads only: no camera.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type D = { _id: string; title: string; status: string };
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const AI_LABEL = "AI-generated preview—details and final appearance may vary.";

export default function TryOn() {
  const params = useSearchParams();
  const [designs, setDesigns] = useState<D[]>([]);
  const [designId, setDesignId] = useState(params.get("design") ?? "");
  const [product, setProduct] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1);
  const [pos, setPos] = useState({ x: 50, y: 50 }); // design centre, % of the photo
  const [size, setSize] = useState(35); // design width, % of the photo width
  const [rotation, setRotation] = useState(0);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ image: string; original: string; designId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const mode = useRef<"move" | "resize" | "rotate" | null>(null);

  useEffect(() => {
    fetch("/api/designs").then((r) => r.json()).then((data) => {
      const list: D[] = data.designs ?? [];
      setDesigns(list);
      // Carry over the design from the design page (?design=…), otherwise pick the first one.
      setDesignId((cur) => (cur && list.some((d) => d._id === cur) ? cur : cur || list[0]?._id || ""));
    }).catch(() => {});
    fetch("/api/try-on").then((r) => r.json()).then((d) => setAiReady(Boolean(d.ai))).catch(() => setAiReady(false));
  }, []);

  function pickFile(f: File | null) {
    setFileError(null);
    setResult(null);
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setFileError("Please choose a JPG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setFileError("Photo must be under 5MB.");
    if (productUrl) URL.revokeObjectURL(productUrl);
    setProduct(f);
    setProductUrl(URL.createObjectURL(f));
    setPos({ x: 50, y: 50 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!mode.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100, py = ((e.clientY - r.top) / r.height) * 100;
    if (mode.current === "move") setPos({ x: Math.min(100, Math.max(0, px)), y: Math.min(100, Math.max(0, py)) });
    const cx = r.left + (pos.x / 100) * r.width, cy = r.top + (pos.y / 100) * r.height;
    if (mode.current === "resize") {
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy); // centre → corner ≈ half diagonal
      setSize(Math.round(Math.min(100, Math.max(5, ((dist * 2) / Math.SQRT2 / r.width) * 100))));
    }
    if (mode.current === "rotate") setRotation(Math.round((Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90));
  }
  const start = (m: "move" | "resize" | "rotate") => (e: React.PointerEvent) => {
    e.stopPropagation();
    mode.current = m;
    box.current?.setPointerCapture(e.pointerId);
  };
  const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

  async function placeWithGemini() {
    if (!product || !designId || !productUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("product", product);
    form.append("designId", designId);
    form.append("x", String(pos.x));
    form.append("y", String(pos.y));
    form.append("size", String(size));
    form.append("rotation", String(norm(rotation)));
    try {
      const res = await fetch("/api/try-on", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.image) throw new Error(data.error || "Gemini couldn't make the preview. Please try again.");
      setResult({ image: data.image, original: productUrl, designId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const selected = designs.find((d) => d._id === designId);
  const step = "font-serif text-lg font-semibold text-violet-900";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl font-semibold text-violet-900">Try It On</h1>
        <p className="text-stone-600">Upload a photo of your cup, vase, shirt or anything else and see a design on it before you buy.</p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-[#ece3d9] bg-white/80 p-5 shadow-sm sm:grid-cols-2">
        <label className="block">
          <span className={step}>1. Upload your product photo</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-violet-100 file:px-4 file:py-2 file:font-semibold file:text-violet-800 hover:file:bg-violet-200"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <span className="mt-1 block text-xs text-stone-500">JPG, PNG or WebP, up to 5MB.</span>
          {fileError && <span className="mt-1 block text-sm text-red-700">{fileError}</span>}
        </label>
        <label className="block">
          <span className={step}>2. Choose a design</span>
          <div className="mt-2 flex items-center gap-3">
            {designId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/designs/${designId}/image`} alt="" className="h-12 w-12 rounded-xl border border-stone-200 object-cover" />
            )}
            <select value={designId} onChange={(e) => { setDesignId(e.target.value); setResult(null); }}
              className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2">
              {designs.length === 0 && <option value="">No designs yet</option>}
              {designs.map((d) => <option key={d._id} value={d._id}>{d.title}{d.status === "sold" ? " (owned)" : ""}</option>)}
            </select>
          </div>
        </label>
      </div>

      <section className="space-y-3">
        <h2 className={step}>3. Position it by hand</h2>
        <p className="text-sm text-stone-500">Drag the design to move it. Use the ↘ corner to resize and the ⟳ handle to rotate.</p>
        <div className="mx-auto max-w-xl">
          <span className="mb-2 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">Manual preview (not AI-generated)</span>
          <div ref={box} onPointerMove={onPointerMove} onPointerUp={() => (mode.current = null)} onPointerCancel={() => (mode.current = null)}
            style={{ aspectRatio: productUrl ? aspect : 1 }}
            className="relative w-full touch-none select-none overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
            {productUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productUrl} alt="Your product" draggable={false} className="h-full w-full object-fill"
                onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1)} />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-stone-400">Upload a product photo to start</p>
            )}
            {productUrl && designId && (
              <div onPointerDown={start("move")} className="absolute cursor-move"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/designs/${designId}/image`} alt="Design" draggable={false} className="block w-full opacity-90 mix-blend-multiply outline outline-1 outline-dashed outline-violet-500" />
                <span onPointerDown={start("rotate")} title="Rotate" aria-label="Rotate"
                  className="absolute -top-9 left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-violet-300 bg-white text-sm text-violet-700 shadow">⟳</span>
                <span onPointerDown={start("resize")} title="Resize" aria-label="Resize"
                  className="absolute -bottom-3 -right-3 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-full border border-violet-300 bg-white text-xs text-violet-700 shadow">↘</span>
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <label>Size <input type="range" min={5} max={100} value={size} onChange={(e) => setSize(+e.target.value)} className="block w-full accent-violet-600" /></label>
            <label>Rotate <input type="range" min={-180} max={180} value={norm(rotation)} onChange={(e) => setRotation(+e.target.value)} className="block w-full accent-violet-600" /></label>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-violet-200 bg-violet-50/50 p-5">
        <h2 className={step}>4. Place it with Gemini</h2>
        <p className="text-sm text-stone-600">
          When you click the button, your uploaded photo and the selected design&apos;s watermarked preview are sent to Google Gemini
          to create the AI preview. Don&apos;t upload photos with people or private information.
        </p>
        {aiReady === false && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">AI try-on isn&apos;t available on this server right now. Your manual preview above still works.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={placeWithGemini} disabled={!product || !designId || busy || aiReady === false}
            className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
            {busy ? "Gemini is placing your design…" : "✨ Place it with Gemini"}
          </button>
          {error && !busy && (
            <button onClick={placeWithGemini} className="rounded-full border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 hover:bg-violet-50">Try again</button>
          )}
        </div>
        {busy && <p className="text-sm text-violet-800">This usually takes 10–30 seconds.</p>}
        {error && !busy && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {result && (
        <section className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="space-y-2">
              <figcaption className="text-sm font-semibold text-stone-600">Original Photo</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.original} alt="Your original product photo" className="w-full rounded-2xl border border-stone-200 bg-white object-contain" />
            </figure>
            <figure className="space-y-2">
              <figcaption className="text-sm font-semibold text-violet-800">AI Try-On</figcaption>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.image} alt="AI-generated try-on preview" className="w-full rounded-2xl border border-violet-200 bg-white object-contain" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/designs/${result.designId}/image`} alt={`Selected design${selected ? `: ${selected.title}` : ""}`}
                  className="absolute right-3 top-3 h-14 w-14 rounded-xl border-2 border-white object-cover shadow-md sm:h-16 sm:w-16" />
              </div>
            </figure>
          </div>
          <p className="text-center text-xs font-medium text-stone-500">{AI_LABEL}</p>
        </section>
      )}
    </div>
  );
}
