import { NextResponse } from "next/server";
import { askOwnique, type ChatMessage } from "@/lib/assistant";

export const maxDuration = 60;

// POST /api/assistant { messages: [{role, content}], image?: "data:image/png;base64,..." }
export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; image?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (!messages.length) return NextResponse.json({ error: "Say something first!" }, { status: 400 });

  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : null;
  if (image && image.length > 4_500_000) return NextResponse.json({ error: "Image must be under 3MB." }, { status: 400 });

  try {
    const reply = await askOwnique(messages, image);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ reply: "Sorry, something went wrong. Please try again." });
  }
}
