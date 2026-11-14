// 🌱 Adds 8 sample designs so the shop looks alive for the demo.
// Run:  npm run seed
// Optional: put your own wallet in SEED_DESIGNER_WALLET (in .env.local) so 3 designs are "yours".
import mongoose from "mongoose";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { Keypair } from "@solana/web3.js";

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI missing. Add it to .env.local first.");
  process.exit(1);
}

// Same perceptual hash as src/lib/imageHash.ts
async function dHash(bytes) {
  const px = await sharp(bytes).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] + 3 ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

const W = 800;
const art = {
  waves: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/>` +
    Array.from({ length: 9 }, (_, i) => `<path d="M0 ${90 + i * 80} Q200 ${30 + i * 80} 400 ${90 + i * 80} T800 ${90 + i * 80}" stroke="${b}" stroke-width="22" fill="none" stroke-linecap="round" opacity="${0.4 + i * 0.07}"/>`).join(""),
  sun: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/><circle cx="400" cy="400" r="210" fill="${b}"/>` +
    Array.from({ length: 16 }, (_, i) => `<rect x="392" y="80" width="16" height="90" rx="8" fill="${b}" transform="rotate(${i * 22.5} 400 400)"/>`).join(""),
  grid: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/>` +
    Array.from({ length: 36 }, (_, i) => `<circle cx="${100 + (i % 6) * 120}" cy="${100 + Math.floor(i / 6) * 120}" r="${20 + ((i * 7) % 5) * 9}" fill="${b}"/>`).join(""),
  bloom: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/>` +
    Array.from({ length: 8 }, (_, i) => `<ellipse cx="400" cy="250" rx="80" ry="170" fill="${b}" opacity="0.75" transform="rotate(${i * 45} 400 400)"/>`).join("") +
    `<circle cx="400" cy="400" r="70" fill="${a}"/>`,
  stripes: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/>` +
    Array.from({ length: 10 }, (_, i) => `<rect x="${i * 80}" y="0" width="40" height="${W}" fill="${b}" transform="skewX(-15)"/>`).join(""),
  mountains: (a, b) => `<rect width="${W}" height="${W}" fill="${a}"/><circle cx="600" cy="220" r="80" fill="#fde68a"/>` +
    `<polygon points="0,800 250,300 500,800" fill="${b}"/><polygon points="300,800 560,380 800,800" fill="${b}" opacity="0.7"/>`,
};

const samples = [
  ["Midnight Waves", "cup", 0.4, "waves", "#1e1b4b", "#818cf8", 0],
  ["Golden Hour", "tote", 0.6, "sun", "#fb923c", "#fef3c7", 0],
  ["Polka Party", "phone case", 0.3, "grid", "#fdf2f8", "#ec4899", 1],
  ["Lotus Bloom", "shirt", 0.8, "bloom", "#ecfccb", "#16a34a", 1],
  ["Retro Stripes", "glasses", 0.25, "stripes", "#fef9c3", "#7c3aed", 2],
  ["Quiet Peaks", "cup", 0.5, "mountains", "#e0f2fe", "#0f766e", 2],
  ["Neon Sun", "glasses", 0.35, "sun", "#111827", "#22d3ee", 0],
  ["Ocean Dots", "tote", 0.45, "grid", "#0c4a6e", "#7dd3fc", 1],
];

const designers = [
  process.env.SEED_DESIGNER_WALLET || Keypair.generate().publicKey.toBase58(),
  Keypair.generate().publicKey.toBase58(),
  Keypair.generate().publicKey.toBase58(),
];
const buyer = Keypair.generate().publicKey.toBase58();

await mongoose.connect(process.env.MONGODB_URI);
const Design = mongoose.connection.collection("designs");
const User = mongoose.connection.collection("users");

let added = 0;
for (const [i, [title, category, price, kind, a, b, who]] of samples.entries()) {
  const png = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">${art[kind](a, b)}</svg>`)).png().toBuffer();
  const imageHash = createHash("sha256").update(png).digest("hex");
  if (await Design.findOne({ imageHash })) continue; // already seeded
  const sold = i === 1 || i === 4; // two designs already have owners
  await Design.insertOne({
    title, price, category,
    imageData: png, imageType: "image/png", imageHash, dHash: await dHash(png),
    designerWallet: designers[who],
    ownerWallet: sold ? buyer : null,
    status: sold ? "sold" : "listed",
    description: `"${title}" is an original ${category} design. Sold once, to one owner, with the designer credited forever.`,
    tags: [category, kind, "original", "one-of-a-kind", "ownique"],
    describedByGrok: false,
    mintAddress: null, txSignature: null,
    soldAt: sold ? new Date() : null,
    agreedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), __v: 0,
  });
  added++;
}
for (const w of [...designers, buyer])
  await User.updateOne({ walletAddress: w }, { $setOnInsert: { walletAddress: w, verified: false, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });

console.log(`🌱 Added ${added} sample designs (${samples.length - added} already existed).`);
await mongoose.disconnect();
