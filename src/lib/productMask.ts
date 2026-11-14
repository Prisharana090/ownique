// Automatic product detection for Try It On (in the browser, no AI): treats the photo's border colors as background,
// flood-fills them inward, and keeps the largest remaining shape as the product. Returns a mask canvas
// (opaque white = product) at a small working size; callers scale it up when clipping.
type RGB = [number, number, number];
const d2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export type ProductMask = { canvas: HTMLCanvasElement; coverage: number; ok: boolean };

export function detectProduct(photo: HTMLImageElement, sensitivity = 30): ProductMask {
  const S = 320, k = Math.min(1, S / Math.max(photo.naturalWidth, photo.naturalHeight));
  const w = Math.max(8, Math.round(photo.naturalWidth * k)), h = Math.max(8, Math.round(photo.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(photo, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const at = (i: number): RGB => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];

  // Dominant border colors (the background).
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const bins = new Map<number, { n: number; c: RGB }>();
  for (const i of border) {
    const p = at(i), key = ((p[0] >> 5) << 6) | ((p[1] >> 5) << 3) | (p[2] >> 5);
    const b = bins.get(key) ?? { n: 0, c: [0, 0, 0] as RGB };
    b.n++; b.c = [b.c[0] + p[0], b.c[1] + p[1], b.c[2] + p[2]];
    bins.set(key, b);
  }
  const bg = [...bins.values()].sort((a, b) => b.n - a.n).filter((b) => b.n >= border.length * 0.05).slice(0, 4)
    .map((b) => [b.c[0] / b.n, b.c[1] / b.n, b.c[2] / b.n] as RGB);
  const tol = (10 + sensitivity * 1.6) ** 2;

  // Flood fill background from the border: a pixel is background if close to a background color
  // or to the neighbour it was reached from (handles soft gradients and shadows on the backdrop).
  const isBg = new Uint8Array(w * h), stack: number[] = [];
  for (const i of border) if (bg.some((b) => d2(at(i), b) < tol)) { isBg[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, p = at(i);
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || isBg[j]) continue;
      const q = at(j);
      if (d2(q, p) < tol * 0.25 || bg.some((b) => d2(q, b) < tol)) { isBg[j] = 1; stack.push(j); }
    }
  }

  // Keep the largest non-background shape (interior holes are filled because only border-connected pixels are background).
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (isBg[s] || label[s] !== -1) continue;
    let size = 0;
    const st = [s]; label[s] = id;
    while (st.length) {
      const i = st.pop()!, x = i % w; size++;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && !isBg[j] && label[j] === -1) { label[j] = id; st.push(j); }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }

  // Shrink by one pixel so the print never touches the backdrop at the edge.
  const out = ctx.createImageData(w, h);
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    const x = i % w, inside = (j: number) => j >= 0 && j < w * h && label[j] === best;
    if (inside(i) && inside(i - 1) && inside(i + 1) && inside(i - w) && inside(i + w) && x > 0 && x < w - 1) {
      out.data.set([255, 255, 255, 255], i * 4);
      count++;
    }
  }
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(out, 0, 0);
  const coverage = count / (w * h);
  // Too small or (almost) the whole photo means the edges couldn't be told apart from the background.
  return { canvas: c, coverage, ok: coverage > 0.03 && coverage < 0.97 };
}
