// Google Gemini helpers: compare two designs, and render a design onto a product photo.
import "server-only";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Text + vision models, tried in order (Gemini sometimes reports "high demand" on one model).
const TEXT_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash"].filter(
  (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i
);
// Image editing needs a paid (billing-enabled) Gemini project; on the free tier we fall back to smart placement.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

type Img = { data: Buffer; mimeType: string };
type Part = { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } };

const imgPart = (img: Img) => ({ inline_data: { mime_type: img.mimeType, data: img.data.toString("base64") } });

async function generate(model: string, parts: object[], generationConfig?: object) {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({ contents: [{ parts }], ...(generationConfig ? { generationConfig } : {}) }),
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`), { status: res.status });
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []) as Part[];
}

/** Tries each text/vision model until one answers (skips "high demand" / retired models). */
async function generateText(parts: object[]) {
  let last: unknown;
  for (const model of TEXT_MODELS) {
    try {
      return await generate(model, parts);
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      if (status !== 503 && status !== 404 && status !== 429) throw err;
    }
  }
  throw last;
}

/** Asks Gemini whether two images are the same design (even if resized, recolored or slightly edited). */
export async function isSameDesign(a: Img, b: Img): Promise<{ same: boolean; reason: string }> {
  const parts = await generateText([
    {
      text:
        'You protect a design marketplace from stolen art. Are these two images the SAME design, ' +
        "even if cropped, resized, recolored, flipped or lightly edited? " +
        'Reply ONLY with JSON: {"same": boolean, "reason": string (one short sentence)}',
    },
    imgPart(a),
    imgPart(b),
  ]);
  const text = parts.map((p) => p.text ?? "").join("");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { same: Boolean(json.same), reason: String(json.reason ?? "") };
}

/**
 * Asks Gemini's image model to apply the artwork to the product surface, using the user's placement guide.
 * Tries the configured image model, then a fallback, before giving up.
 */
export async function renderTryOn(
  product: Img, artwork: Img, guide: Img,
  p: { x: number; y: number; size: number; rotation: number }
): Promise<{ data: string; mimeType: string }> {
  const prompt =
    "You are editing a product photo to preview a printed design.\n" +
    "Image 1: the ORIGINAL product photo. Image 2: the ARTWORK (a flat graphic). Image 3: a rough placement guide " +
    "showing where the customer wants the artwork.\n" +
    `Placement: artwork centre at ${Math.round(p.x)}% from the left and ${Math.round(p.y)}% from the top of the photo, ` +
    `about ${Math.round(p.size)}% of the photo width, rotated ${Math.round(p.rotation)} degrees.\n` +
    "Apply the artwork to the product's SURFACE as if printed on it: wrap it to the product's shape and curvature, " +
    "and match the photo's lighting, shadows and texture. Treat the artwork strictly as a flat printed graphic: do NOT " +
    "turn anything in it into real 3D objects (for example, floral artwork must appear printed on a vase, never as real " +
    "flowers inside it). Keep the artwork's colours, shapes and any watermark text as close to Image 2 as possible. " +
    "Do not change the product's shape, the background, the framing or anything else in the photo. Return one image.";
  const parts = [{ text: prompt }, imgPart(product), imgPart(artwork), imgPart(guide)];
  const models = [IMAGE_MODEL, "gemini-2.5-flash-image"].filter((m, i, a) => a.indexOf(m) === i);
  let last: unknown;
  for (const model of models) {
    try {
      const out = await generate(model, parts, { responseModalities: ["TEXT", "IMAGE"] });
      for (const part of out) {
        if (part.inlineData) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
        if (part.inline_data) return { data: part.inline_data.data, mimeType: part.inline_data.mime_type };
      }
      last = new Error("Gemini didn't return an image.");
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      if (status !== 404 && status !== 503) throw err;
    }
  }
  throw last;
}

/**
 * Free-tier Try It On: Gemini looks at the product photo and the design and decides
 * where the design should go (position, size, rotation), plus a short styling tip.
 */
export async function suggestPlacement(product: Img, design: Img) {
  const parts = await generateText([
    {
      text:
        "The first image is a product photo (for example a cup, glasses, shirt, phone case or tote). " +
        "The second image is a design to print on it. Decide where the design should be printed on the product " +
        "so it looks natural. Reply ONLY with JSON: " +
        '{"x": number (0-100, % from left of the photo to the design center), "y": number (0-100, % from top), ' +
        '"size": number (10-90, design width as % of the photo width), "rotation": number (-45 to 45 degrees), ' +
        '"product": string (what the product is), "tip": string (one friendly sentence on how good it looks and why)}',
    },
    imgPart(product),
    imgPart(design),
  ]);
  const text = parts.map((p) => p.text ?? "").join("");
  const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    x: clamp(j.x, 0, 100, 50),
    y: clamp(j.y, 0, 100, 50),
    size: clamp(j.size, 10, 90, 35),
    rotation: clamp(j.rotation, -45, 45, 0),
    product: String(j.product ?? "product"),
    tip: String(j.tip ?? ""),
  };
}
