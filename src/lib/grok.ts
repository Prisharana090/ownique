// Asks Grok (xAI) to write a short description + tags for a new design.
// Falls back to a simple description if no key is set, so the site still works.
export async function describeWithGrok(title: string, category: string) {
  const key = process.env.XAI_API_KEY;
  const fallback = {
    description: `"${title}" is an original ${category} design, sold once to one owner.`,
    tags: [category, "original", "one-of-a-kind"],
    byGrok: false,
  };
  if (!key) return fallback;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-4",
        messages: [
          {
            role: "system",
            content:
              'You write product copy for a design marketplace. Reply ONLY with JSON: {"description": string (2 friendly sentences), "tags": string[] (5 short tags)}',
          },
          { role: "user", content: `Design title: ${title}. Made for: ${category}.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Grok error ${res.status}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return { description: String(json.description), tags: (json.tags as string[]).slice(0, 5), byGrok: true };
  } catch (err) {
    console.error("Grok failed, using fallback:", err);
    return fallback;
  }
}
