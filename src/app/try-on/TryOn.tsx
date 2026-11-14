"use client";
// Try It On: place a design on a photo of your own product (drag, resize, rotate),
// then ask Gemini to make it look like a real printed product.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type D = { _id: string; title: string; status: string };

export default function TryOn() {
  const params = useSearchParams();
  const [designs, setDesigns] = useState<D[]>([]);
  const [designId, setDesignId] = useState(params.get("design") ?? "");
  const [product, setProduct] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 }); // % of the photo
  const [size, setSize] = useState(35); // % of photo width
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    fetch("/api/designs")
      .then((r) => r.json())
      .then((data) => {
        setDesigns(data.designs ?? []);
        if (!designId && data.designs?.[0]) setDesignId(data.designs[0]._id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMove(e: React.PointerEvent) {
    if (!dragging.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setPos({
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    });
  }

  async function makeRealistic() {
    if (!product || !designId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setTip(null);
    const form = new FormData();
    form.append("product", product);
    form.append("designId", designId);
    try {
      const res = await fetch("/api/try-on", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.image) setResult(data.image);
      if (data.placement) {
        // Gemini placed the design for us: move it on the live preview
        setPos({ x: data.placement.x, y: data.placement.y });
        setSize(Math.round(data.placement.size));
        setRotation(Math.round(data.placement.rotation));
        setTip(`✨ Gemini placed it on your ${data.placement.product}. ${data.placement.tip}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">☕ Try It On</h1>
        <p className="text-stone-600">See a design on your own cup, glasses, shirt or anything else — before you buy.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">1. Photo of your product</span>
          <input type="file" accept="image/*" className="mt-1 block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setProduct(f);
              setProductUrl(f ? URL.createObjectURL(f) : null);
              setResult(null);
            }} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">2. Pick a design</span>
          <select value={designId} onChange={(e) => { setDesignId(e.target.value); setResult(null); }}
            className="mt-1 block rounded-xl border border-stone-300 px-3 py-2">
            {designs.length === 0 && <option value="">No designs yet</option>}
            {designs.map((d) => <option key={d._id} value={d._id}>{d.title}{d.status === "sold" ? " (owned)" : ""}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Size</span>
          <input type="range" min={10} max={90} value={size} onChange={(e) => setSize(+e.target.value)} className="mt-2 block accent-violet-600" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Rotate</span>
          <input type="range" min={-180} max={180} value={rotation} onChange={(e) => setRotation(+e.target.value)} className="mt-2 block accent-violet-600" />
        </label>
        <button onClick={makeRealistic} disabled={!product || !designId || busy}
          className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
          {busy ? "Gemini is looking… ✨" : "✨ Place it with Gemini"}
        </button>
      </div>

      {tip && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{tip}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} You can still use the drag preview.</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-500">Quick preview — drag the design to move it</p>
          <div ref={box} onPointerMove={onMove} onPointerUp={() => (dragging.current = false)} onPointerLeave={() => (dragging.current = false)}
            className="relative aspect-square touch-none select-none overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
            {productUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productUrl} alt="Your product" className="h-full w-full object-contain" draggable={false} />
            ) : (
              <p className="flex h-full items-center justify-center text-stone-400">Upload a product photo</p>
            )}
            {productUrl && designId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/designs/${designId}/image`} alt="Design" draggable={false}
                onPointerDown={() => (dragging.current = true)}
                className="absolute cursor-move opacity-90 mix-blend-multiply"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-500">Realistic render by Gemini (when available)</p>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result} alt="Realistic preview" className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-stone-400">{busy ? "Working on it…" : "Gemini places your design on the left. With a paid Gemini plan, a photorealistic render appears here."}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
