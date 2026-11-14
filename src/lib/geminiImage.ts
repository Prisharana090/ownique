// Gemini image editing for "Generate AI Try-On" (server only; the API key never reaches the browser).
// Opt-in: AI_PREVIEW_PROVIDER=gemini. Image models are billed (no free tier), so it's off unless enabled.
import "server-only";
import { AiError } from "@/lib/cloudflareAi";

export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
export const geminiImageEnabled = () => process.env.AI_PREVIEW_PROVIDER === "gemini" && Boolean(process.env.GEMINI_API_KEY);

type Part = { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } };

/** Sends the prompt + reference images (JPEG) and returns the generated image as base64. No automatic retries. */
export async function editWithGemini(prompt: string, images: Buffer[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...images.map((b) => ({ inline_data: { mime_type: "image/jpeg", data: b.toString("base64") } }))] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new AiError("Gemini took too long. Please try again later.", "timeout");
    throw new AiError("Couldn't reach Google Gemini.", "unavailable");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (res.ok) {
    const parts: Part[] = JSON.parse(text).candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      if (p.inlineData?.data) return p.inlineData.data;
      if (p.inline_data?.data) return p.inline_data.data;
    }
    throw new AiError("Gemini didn't return an image this time (it may have declined the request). Your manual mockup still works.", "failed");
  }
  // Log only status + Google's message (never the key).
  console.warn("Gemini image error", res.status, text.slice(0, 300));
  if (res.status === 429 && /limit: 0|free_tier|FreeTier/i.test(text))
    throw new AiError("Gemini image generation needs billing turned on for this Google project.", "config");
  if (res.status === 429) throw new AiError("Gemini's usage limit was reached. Please try again later.", "exhausted");
  if (res.status === 400 && /billing|API key/i.test(text)) throw new AiError("The Gemini API key or billing setup isn't valid for image generation.", "config");
  if (res.status === 403) throw new AiError("This Google project doesn't have permission to use the Gemini image model.", "config");
  if (res.status === 404) throw new AiError(`The Gemini model "${GEMINI_IMAGE_MODEL}" isn't available to this project.`, "unavailable");
  if (res.status >= 500) throw new AiError("Gemini is unavailable right now. Your manual mockup still works.", "unavailable");
  throw new AiError("Gemini couldn't create the preview. Your manual mockup still works.", "failed");
}
