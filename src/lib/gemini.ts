// Google Gemini helpers: compare two designs, and render a design onto a product photo.
import "server-only";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

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
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []) as Part[];
}

/** Asks Gemini whether two images are the same design (even if resized, recolored or slightly edited). */
export async function isSameDesign(a: Img, b: Img): Promise<{ same: boolean; reason: string }> {
  const parts = await generate(TEXT_MODEL, [
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
