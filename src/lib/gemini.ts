// Google Gemini helpers: compare two designs (copy detection). Try It On no longer uses Gemini.
import "server-only";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Text + vision models, tried in order (Gemini sometimes reports "high demand" on one model).
const TEXT_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(
  (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i
);

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

type Img = { data: Buffer; mimeType: string };
type Part = { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } };

const imgPart = (img: Img) => ({ inline_data: { mime_type: img.mimeType, data: img.data.toString("base64") } });

const PER_TRY_MS = 10_000; // one model attempt
const TOTAL_MS = 20_000; // all attempts together, so an upload never hangs on a busy Gemini

async function generate(model: string, parts: object[], generationConfig?: object) {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(PER_TRY_MS),
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
  const deadline = Date.now() + TOTAL_MS;
  for (const model of TEXT_MODELS) {
    if (Date.now() > deadline) break;
    try {
      return await generate(model, parts);
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      const timedOut = (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError";
      if (!timedOut && status !== 503 && status !== 404 && status !== 429) throw err;
    }
  }
  throw last ?? new Error("Gemini took too long");
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
