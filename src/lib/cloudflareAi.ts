// Cloudflare Workers AI: FLUX.2 [klein] 4B image editing with reference images (server-only; token never leaves the server).
import "server-only";

export const CF_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
export const hasCloudflareAi = () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

export class AiError extends Error {
  constructor(message: string, public code: "config" | "exhausted" | "unavailable" | "timeout" | "failed") { super(message); }
}

/** Sends up to 4 reference images (each ≤512×512) + prompt; returns the generated image (base64). No automatic retries. */
export async function editWithFlux(opts: { prompt: string; images: Buffer[]; width: number; height: number }) {
  const form = new FormData();
  form.append("prompt", opts.prompt);
  form.append("width", String(opts.width));
  form.append("height", String(opts.height));
  opts.images.slice(0, 4).forEach((img, i) => form.append(`input_image_${i}`, new Blob([new Uint8Array(img)], { type: "image/jpeg" }), `ref${i}.jpg`));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CF_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      body: form,
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new AiError("The AI preview took too long. Please try again later.", "timeout");
    throw new AiError("Couldn't reach Cloudflare Workers AI.", "unavailable");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: { success?: boolean; result?: { image?: string }; errors?: { code?: number; message?: string }[] } = {};
  try { data = JSON.parse(text); } catch { /* non-JSON error */ }
  const msg = (data.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || text).slice(0, 300);
  if (res.ok && data.result?.image) return data.result.image;
  console.warn("Cloudflare AI error", res.status, msg);
  if (res.status === 401 || res.status === 403) throw new AiError("The Cloudflare credentials on the server are missing permission for Workers AI.", "config");
  if (res.status === 429 || /allocation|limit|quota|neuron/i.test(msg))
    throw new AiError("Today's free AI allowance is used up. It resets at midnight UTC. Your manual mockup still works.", "exhausted");
  if (res.status === 404 || res.status >= 500) throw new AiError("The AI image model is unavailable right now. Your manual mockup still works.", "unavailable");
  throw new AiError("The AI preview couldn't be created. Your manual mockup still works.", "failed");
}
