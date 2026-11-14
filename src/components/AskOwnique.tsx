"use client";
// Floating "Ask Ownique" chat bubble, on every page.
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const STARTERS = [
  "How does buying work?",
  "Can I sell a design I already sold elsewhere?",
  "Is my logo too similar to a famous brand?",
];

export default function AskOwnique() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm Ask Ownique 💜 Ask me anything about buying or selling, or attach a design and I'll check it doesn't look like a famous brand logo." },
  ]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  function attach(file: File | null) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alertMsg("That image is over 3MB. Try a smaller one.");
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  function alertMsg(content: string) {
    setMsgs((m) => [...m, { role: "assistant", content }]);
  }

  async function send(question?: string) {
    const content = (question ?? text).trim() || (image ? "Is this design original, or does it look like a famous brand logo?" : "");
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content, image: image ?? undefined }];
    setMsgs(next);
    setText("");
    const sentImage = image;
    setImage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1).map(({ role, content }) => ({ role, content })), image: sentImage }),
      });
      const data = await res.json();
      alertMsg(data.reply ?? data.error ?? "Sorry, something went wrong.");
    } catch {
      alertMsg("Sorry, I couldn't connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Ask Ownique"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg hover:bg-violet-800">
        {open ? "✕ Close" : "💬 Ask Ownique"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-white">
            <p className="font-semibold">Ask Ownique</p>
            <p className="text-xs text-violet-100">Powered by Grok · not legal advice</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-800"}`}>
                  {m.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="Attached design" className="mb-2 max-h-32 rounded-lg" />
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-violet-200 px-3 py-1 text-xs text-violet-700 hover:bg-violet-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && <p className="text-xs text-stone-400">Ask Ownique is thinking…</p>}
            <div ref={end} />
          </div>

          {image && (
            <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="To check" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 text-stone-500">Image attached, ready to check</span>
              <button onClick={() => setImage(null)} className="text-stone-400 hover:text-red-500">✕</button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-stone-200 p-3">
            <label title="Attach a design to check" className="cursor-pointer rounded-lg px-2 py-1 text-lg hover:bg-stone-100">
              📎
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { attach(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={image ? "Ask about this design…" : "Ask anything…"}
              className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-violet-500" />
            <button disabled={busy || (!text.trim() && !image)} className="rounded-full bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
