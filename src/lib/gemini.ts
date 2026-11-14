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

/** Asks Gemini's image model to print the design naturally onto the product photo. */
export async function renderTryOn(product: Img, design: Img): Promise<{ data: string; mimeType: string }> {
  const parts = await generate(
    IMAGE_MODEL,
    [
      {
        text:
          "The first image is a product photo. The second image is a design. Print the design naturally onto the " +
          "product so it follows the product's shape, curves, lighting and shadows, like a real printed product. " +
          "Keep everything else in the photo the same.",
      },
      imgPart(product),
      imgPart(design),
    ],
    { responseModalities: ["TEXT", "IMAGE"] }
  );
  for (const p of parts) {
    if (p.inlineData) return { data: p.inlineData.data, mimeType: p.inlineData.mimeType };
    if (p.inline_data) return { data: p.inline_data.data, mimeType: p.inline_data.mime_type };
  }
  throw new Error("Gemini didn't return an image. Try again.");
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
