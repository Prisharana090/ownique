// 🤖 Grok Bot — summarizes each push with Grok and appends it to CHANGELOG.md.
// Runs inside GitHub Actions (see .github/workflows/grok-bot.yml).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const { XAI_API_KEY, DISCORD_WEBHOOK_URL, BEFORE, AFTER, GROK_MODEL = "grok-4" } = process.env;
if (!XAI_API_KEY) {
  console.log("XAI_API_KEY secret not set — skipping Grok Bot.");
  process.exit(0);
}

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const zero = /^0+$/.test(BEFORE ?? "");
const range = !BEFORE || zero ? AFTER : `${BEFORE}..${AFTER}`;
const commits = sh(zero || !BEFORE ? `git log -1 --format="- %s" ${AFTER}` : `git log --format="- %s" ${range}`);
const files = sh(zero || !BEFORE ? `git show --name-only --format= ${AFTER}` : `git diff --name-only ${range}`)
  .split("\n")
  .filter(Boolean)
  .slice(0, 60)
  .join("\n");

const res = await fetch("https://api.x.ai/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI_API_KEY}` },
  body: JSON.stringify({
    model: GROK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are Grok Bot for Ownique, a hackathon design marketplace. Summarize a git push for teammates " +
          "in 2-4 short, friendly bullet points (markdown '- '). Plain English, no jargon, no file paths.",
      },
      { role: "user", content: `Commits:\n${commits}\n\nChanged files:\n${files}` },
    ],
  }),
});
if (!res.ok) {
  console.error("Grok request failed:", res.status, await res.text());
  process.exit(0); // never fail the build because of the bot
}
const summary = (await res.json()).choices?.[0]?.message?.content?.trim();
if (!summary) process.exit(0);

const date = new Date().toISOString().slice(0, 16).replace("T", " ");
const entry = `## ${date} UTC · \`${AFTER.slice(0, 7)}\`\n\n${summary}\n\n`;
const header = "# 🤖 Ownique Changelog\n\n_Written automatically by Grok Bot on every push._\n\n";
const old = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8").replace(header, "") : "";
writeFileSync("CHANGELOG.md", header + entry + old);
console.log(entry);

if (DISCORD_WEBHOOK_URL) {
  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Grok Bot", content: `🤖 **New Ownique update**\n${summary}`.slice(0, 1900) }),
  }).catch(() => {});
}
