// Transactional email (server only) via Resend's HTTP API. Configure RESEND_API_KEY and EMAIL_FROM in .env.local.
import "server-only";

export const hasEmail = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** The public site URL used in emails. Never taken from request headers (prevents link spoofing). */
export function siteUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
}

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasEmail()) return { ok: false, error: "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).name === "AbortError" ? "Email service timed out." : "Couldn't reach the email service." };
  } finally {
    clearTimeout(t);
  }
}

export function resetEmail(link: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#fbf8f2;font-family:Arial,sans-serif;color:#2a1f2d">
  <div style="max-width:480px;margin:32px auto;background:#fff;border:1px solid #ece3d9;border-radius:20px;padding:28px">
    <p style="font-family:Georgia,serif;font-size:24px;color:#35223f;margin:0 0 16px">Own<i style="color:#c46c8d">ique</i></p>
    <p style="font-size:16px;margin:0 0 12px">We received a request to reset your Ownique password.</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#5b3f7c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Choose a new password</a></p>
    <p style="font-size:13px;color:#6b6070;margin:0 0 8px">This link works once and expires in 1 hour.</p>
    <p style="font-size:13px;color:#6b6070;margin:0">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
  </div></body></html>`;
  const text = `We received a request to reset your Ownique password.\n\nChoose a new password: ${link}\n\nThis link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`;
  return { subject: "Reset your Ownique password", html, text };
}
