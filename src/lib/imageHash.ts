// Perceptual "difference hash": similar-looking images get similar hashes,
// even after resizing, recompressing or small color changes.
import sharp from "sharp";

export async function dHash(bytes: Buffer): Promise<string> {
  const px = await sharp(bytes).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] + 3 ? "1" : "0"; // +3 ignores tiny compression noise
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

/** How many of the 64 bits differ (0 = identical look, 64 = completely different). */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let count = 0;
  while (x) {
    count += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return count;
}
