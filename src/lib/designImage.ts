// Loads a design's original image bytes from MongoDB, and makes watermarked previews.
import "server-only";
import sharp from "sharp";
import { Design } from "@/models/Design";

export async function loadOriginal(id: string) {
  const d = await Design.findById(id)
    .select("+imageData imageType title status ownerWallet")
    .lean<{ imageData: unknown; imageType: string; title: string; status: string; ownerWallet: string | null }>();
  if (!d) return null;
  const raw = d.imageData as Buffer | { buffer: Uint8Array };
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);
  return { ...d, bytes };
}

/** Smaller copy with a repeated "Ownique • Preview" watermark, so nobody can screenshot it and skip paying. */
export async function watermark(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rows = Math.ceil(height / 110) + 4;
  const lines = Array.from({ length: rows }, (_, i) =>
    `<text x="${-width + (i % 2 ? -60 : 0)}" y="${i * 110 - 110}">${"Ownique • Preview   ".repeat(10)}</text>`
  ).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g transform="rotate(-20 ${width / 2} ${height / 2})" font-family="Arial, sans-serif" font-size="30"
       font-weight="700" fill="white" fill-opacity="0.38" stroke="black" stroke-opacity="0.18" stroke-width="1">${lines}</g>
  </svg>`);
  return sharp(data).composite([{ input: svg, top: 0, left: 0 }]).flatten({ background: "#ffffff" }).jpeg({ quality: 72 }).toBuffer();
}
