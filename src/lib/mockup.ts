// In-browser product mockup renderer (no AI, no server): draws the artwork onto the photo through a
// 4-corner perspective transform, using a triangle mesh on <canvas>. Flat projection only, no surface wrapping.
export type Pt = { x: number; y: number };

/** Projective map from the unit square to the quad [tl, tr, br, bl] (Heckbert's square-to-quad). */
function squareToQuad(q: Pt[]) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if ((dx3 || dy3) && Math.abs(den) > 1e-9) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u: number, v: number): Pt => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

/** Draws one source triangle of `img` onto the destination triangle (affine, clipped, slightly enlarged to hide seams). */
function drawTriangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Pt[], d: Pt[]) {
  const cx = (d[0].x + d[1].x + d[2].x) / 3, cy = (d[0].y + d[1].y + d[2].y) / 3;
  ctx.save();
  ctx.beginPath();
  d.forEach((p, i) => {
    const len = Math.hypot(p.x - cx, p.y - cy) || 1;
    const x = p.x + ((p.x - cx) / len) * 0.6, y = p.y + ((p.y - cy) / len) * 0.6;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
  // Solve the affine transform that maps s[i] → d[i].
  const [s0, s1, s2] = s, [d0, d1, d2] = d;
  const den = s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y;
  if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
  const m11 = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / den;
  const m12 = (s1.y * d2.y + s0.y * (d1.y - d2.y) - s2.y * d1.y + (s2.y - s1.y) * d0.y) / den;
  const m21 = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / den;
  const m22 = -(s1.x * d2.y + s0.x * (d1.y - d2.y) - s2.x * d1.y + (s2.x - s1.x) * d0.y) / den;
  const dx = (s0.x * (s2.y * d1.x - s1.y * d2.x) + s0.y * (s1.x * d2.x - s2.x * d1.x) + (s2.x * s1.y - s1.x * s2.y) * d0.x) / den;
  const dy = (s0.x * (s2.y * d1.y - s1.y * d2.y) + s0.y * (s1.x * d2.y - s2.x * d1.y) + (s2.x * s1.y - s1.x * s2.y) * d0.y) / den;
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export type Blend = "source-over" | "multiply" | "overlay" | "soft-light" | "screen" | "darken";

/**
 * Renders photo + warped artwork into `canvas` at width×height. `quad` is in the same pixel space.
 * The artwork is warped on its own layer first, then blended onto the photo once (no seams in blend modes).
 */
export function renderMockup(
  canvas: HTMLCanvasElement, photo: CanvasImageSource, art: HTMLImageElement | HTMLCanvasElement,
  quad: Pt[], width: number, height: number, opts: { opacity: number; blend: Blend; grid?: number }
) {
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't draw the preview.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const lctx = layer.getContext("2d")!;
  lctx.imageSmoothingQuality = "high";
  const map = squareToQuad(quad);
  const n = opts.grid ?? 16;
  const aw = art instanceof HTMLImageElement ? art.naturalWidth : art.width;
  const ah = art instanceof HTMLImageElement ? art.naturalHeight : art.height;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
      const S = (u: number, v: number) => ({ x: u * aw, y: v * ah });
      const a = map(u0, v0), b = map(u1, v0), c = map(u1, v1), d = map(u0, v1);
      drawTriangle(lctx, art, [S(u0, v0), S(u1, v0), S(u1, v1)], [a, b, c]);
      drawTriangle(lctx, art, [S(u0, v0), S(u1, v1), S(u0, v1)], [a, c, d]);
    }
  }
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.globalCompositeOperation = opts.blend;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}
