// Preview-only design customization in the browser: recolor, replace one color, hide a flat background.
// Works on a copy of the WATERMARKED preview pixels; the designer's original file is never touched.
export type RGB = { r: number; g: number; b: number };
export type ColorSettings = {
  mode: "none" | "tint" | "replace";
  target: string; // hex
  source: string; // hex (replace mode)
  tolerance: number; // 0-100
  hideBg: boolean;
  bg: string; // hex
  bgTolerance: number; // 0-100
};
export const DEFAULT_COLORS: ColorSettings = {
  mode: "none", target: "#7c3aed", source: "#000000", tolerance: 25, hideBg: false, bg: "#ffffff", bgTolerance: 12,
};
export const isCustomized = (s: ColorSettings) => s.mode !== "none" || s.hideBg;

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
export const rgbToHex = ({ r, g, b }: RGB) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const isHex = (s: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}
function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
}
// Perceptual-ish distance (0-100) between two colors.
const dist = (r: number, g: number, b: number, c: RGB) => {
  const dr = r - c.r, dg = g - c.g, db = b - c.b, rm = (r + c.r) / 2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 7.65;
};

/** Most common colors (for picking a source color in multicolor designs). */
export function palette(img: ImageData, count = 6): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const d = img.data;
  for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
    if (d[i + 3] < 128) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
    bins.set(key, e);
  }
  const out: RGB[] = [];
  for (const e of [...bins.values()].sort((a, b) => b.n - a.n)) {
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n };
    if (out.every((o) => dist(c.r, c.g, c.b, o) > 12)) out.push(c);
    if (out.length >= count) break;
  }
  return out.map(rgbToHex);
}

/** Guesses a flat background from the four corners (most common corner color). */
export function cornerColor(img: ImageData): string {
  const { width: w, height: h, data: d } = img;
  const at = (x: number, y: number) => { const i = (y * w + x) * 4; return { r: d[i], g: d[i + 1], b: d[i + 2] }; };
  const cs = [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)];
  let best = cs[0], bestN = 0;
  for (const c of cs) {
    const n = cs.filter((o) => dist(c.r, c.g, c.b, o) < 6).length;
    if (n > bestN) { best = c; bestN = n; }
  }
  return rgbToHex(best);
}

/** Returns a new ImageData with the settings applied (the input is not modified). */
export function applyColors(src: ImageData, s: ColorSettings): ImageData {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = out.data, o = src.data;
  const target = hexToRgb(s.target), th = rgbToHsl(target.r, target.g, target.b);
  const source = hexToRgb(s.source), sh = rgbToHsl(source.r, source.g, source.b);
  const bg = hexToRgb(s.bg);
  const tol = Math.max(1, s.tolerance), btol = Math.max(0.5, s.bgTolerance);
  for (let i = 0; i < d.length; i += 4) {
    const r = o[i], g = o[i + 1], b = o[i + 2];
    // 1) Background mask is measured on the ORIGINAL colors, with a soft edge (keeps anti-aliasing).
    if (s.hideBg) {
      const k = dist(r, g, b, bg);
      const keep = k <= btol ? 0 : k >= btol * 1.6 ? 1 : (k - btol) / (btol * 0.6);
      d[i + 3] = Math.round(o[i + 3] * keep);
    }
    // 2) Recolor, keeping each pixel's lightness so shading and detail survive.
    if (s.mode === "tint") {
      const { l } = rgbToHsl(r, g, b);
      const c = hslToRgb(th.h, th.s, l);
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b;
    } else if (s.mode === "replace") {
      const k = dist(r, g, b, source);
      if (k < tol * 1.4) {
        const w = k <= tol ? 1 : 1 - (k - tol) / (tol * 0.4); // soft edge
        const p = rgbToHsl(r, g, b);
        const c = hslToRgb(th.h, th.s, Math.min(1, Math.max(0, p.l + (th.l - sh.l))));
        d[i] = r + (c.r - r) * w; d[i + 1] = g + (c.g - g) * w; d[i + 2] = b + (c.b - b) * w;
      }
    }
  }
  if (s.hideBg) dropSmallIslands(out);
  return out;
}

/**
 * After hiding the background, the watermark letters that sat on it (and other specks) survive as small floating
 * islands. Keep only the big connected shapes of the design; remove islands smaller than ~0.4% of the image.
 * The watermark printed ON the design itself is untouched.
 */
function dropSmallIslands(img: ImageData) {
  const { width: w, height: h, data: d } = img;
  const n = w * h, label = new Int32Array(n).fill(-1), sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || d[start * 4 + 3] < 40) continue;
    const id = sizes.length;
    let top = 0, size = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const p = stack[--top]; size++;
      const x = p % w, y = (p - x) / w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && label[q] === -1 && d[q * 4 + 3] >= 40) { label[q] = id; stack[top++] = q; }
    }
    sizes.push(size);
  }
  const min = n * 0.004;
  for (let p = 0; p < n; p++) {
    const id = label[p];
    if (id === -1 ? d[p * 4 + 3] > 0 && !hasBigNeighbour(p) : sizes[id] < min) d[p * 4 + 3] = 0;
  }
  // faint edge pixels (alpha < 40) are kept only next to a big shape
  function hasBigNeighbour(p: number) {
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < n && label[q] !== -1 && sizes[label[q]] >= min) return true;
    return false;
  }
}

/** Re-stamps the "Ownique • Preview" watermark (same style as the server) so customizing never removes it. */
export function stampWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const s = width / 800;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-20 * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  ctx.font = `700 ${30 * s}px Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(1, s);
  const line = "Ownique • Preview   ".repeat(10);
  const rows = Math.ceil(height / (110 * s)) + 4;
  for (let i = 0; i < rows; i++) {
    const x = -width + (i % 2 ? -60 * s : 0), y = i * 110 * s - 110 * s;
    ctx.fillText(line, x, y);
    ctx.strokeText(line, x, y);
  }
  ctx.restore();
}

/** Builds the customized artwork canvas from the watermarked preview image. */
export function customizeArt(img: HTMLImageElement, s: ColorSettings): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  if (!isCustomized(s)) return c;
  ctx.putImageData(applyColors(ctx.getImageData(0, 0, c.width, c.height), s), 0, 0);
  // The preview watermark already printed on the design is kept (only background pixels are removed), and the
  // server stamps it again on anything sent to AI. Stamping here too would double it and float text outside the shape.
  return c;
}
