# Ownique 🎨

*Own + Unique:* every design has exactly one owner.

**One design. One owner. Credit forever.**

A design marketplace website where designers sell each design **exactly once**. The buyer gets full ownership, the designer keeps credit forever, and a sold design can never be listed again.

Built at **HackPrinceton Fall 2026** (Business & Enterprise track).

## ✅ What works in this starter
- Solana wallet login (Phantom, devnet). Users are saved in MongoDB Atlas.
- Upload page with the 5 designer confirmation checkboxes
- Grok (xAI) writes each design's description and tags
- Shop page with category filters
- Design page with a watermark preview and an ownership badge once sold
- **Buy & Own It:** buyer pays the designer in SOL, the server verifies the payment on Solana, then moves the 1-of-1 ownership token (Metaplex Core) from the vault to the buyer
- **Copy detector:** blocks exact copies (SHA-256) and look-alike copies (perceptual hash); borderline cases are judged by **Gemini**
- **Try It On:** drag a design onto a photo of your own product, or let **Gemini** look at it and place the design for you (photorealistic render on a paid Gemini plan)
- **Live dashboard:** every view, try-on, sale, upload, blocked copy and report is logged to **Tiger Data** (hypertable + per-minute continuous aggregate) and charted live
- **Watermarked previews:** everyone sees a watermarked copy; only the owner can download the full file by signing with their wallet
- **Certificate of Creation:** a printable proof page for every design (creator, time, file fingerprint, Solana token, owner)
- **Designer profiles:** every design a designer ever made, credited forever, plus what they own
- **Pay with bank (Capital One Nessie):** buyers can pay the designer from a practice bank account instead of crypto; ownership still moves on Solana
- **Ask Ownique:** a LangChain **Deep Agent** (powered by Grok) that searches the shop, reads ownership records and our terms, shows live stats, and checks attached designs for brand / character look-alikes
- **Copyright, trademark & privacy terms** in plain language
- **Report button:** hides a reported design while it's reviewed (reports stored in MongoDB)
- **Grok Bot:** a GitHub Action that asks Grok to summarize every push into `CHANGELOG.md` (and Discord)
- **Ready to deploy on Vultr:** `Dockerfile` + step-by-step `DEPLOY.md` (Nginx, HTTPS, GoDaddy DNS)
- "How ownership works" policy page

## 🔜 Still to do
1. Deploy to Vultr and connect the GoDaddy domain (follow `DEPLOY.md`)
2. Add repo secret `XAI_API_KEY` so Grok Bot runs (GitHub → Settings → Secrets → Actions)
3. Run `npm run seed` for sample designs, then practice the pitch in `DEVPOST.md`

## 🚀 Run it on your computer (Windows)
1. Install **Node.js 20+** from https://nodejs.org
2. Open this folder in **Cursor**, then open the terminal (`Ctrl + ~`)
3. Install packages:
   ```
   npm install
   ```
4. Copy `.env.example` to a new file named `.env.local` and fill in:
   - `MONGODB_URI`: from MongoDB Atlas → Connect → Drivers
   - `XAI_API_KEY`: from console.x.ai (optional; without it, a simple description is used)
   - `GEMINI_API_KEY`: from aistudio.google.com (copy detector + Try It On)
   - `TIGER_DATABASE_URL`: from console.cloud.timescale.com → your service → Connect (live dashboard)
   - `NESSIE_API_KEY`: from Capital One's Nessie developer site (sign in with GitHub) for "Pay with bank"
   - `VAULT_SECRET_KEY`: the private key of a **new, devnet-only** Phantom wallet that holds ownership tokens until they sell. Get free devnet SOL for it at faucet.solana.com. Never use a wallet with real money.
5. (Optional) Add 8 sample designs for the demo:
   ```
   npm run seed
   ```
6. Start the site:
   ```
   npm run dev
   ```
7. Open http://localhost:3000
8. In Phantom: Settings → Developer Settings → switch to **Devnet**

## 🙏 Credits: libraries & services we used
Everything below is open-source or a sponsor service. Our team wrote the Ownique app code during HackPrinceton (Nov 13–15, 2026), with help from AI coding tools (Cursor, Claude).

| What | Used for |
|---|---|
| [Next.js](https://nextjs.org), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com) | Website framework and styling |
| [Mongoose](https://mongoosejs.com) + **MongoDB Atlas** | Database for users, designs, reports |
| [node-postgres (pg)](https://node-postgres.com) + **Tiger Data** (TimescaleDB) | Time-series events + live dashboard |
| [Recharts](https://recharts.org) | Dashboard charts |
| [@solana/web3.js](https://github.com/solana-foundation/solana-web3.js), [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) | Wallet login and SOL payments |
| [Metaplex Umi](https://github.com/metaplex-foundation/umi) + [Metaplex Core](https://developers.metaplex.com/core) | 1-of-1 ownership tokens |
| [bs58](https://github.com/cryptocoinjs/bs58), [TweetNaCl](https://tweetnacl.js.org) | Wallet signature checks |
| [sharp](https://sharp.pixelplumbing.com) | Watermarked previews + perceptual hashing |
| [LangChain](https://js.langchain.com) + [Deep Agents](https://github.com/langchain-ai/deepagentsjs) + [@langchain/xai](https://www.npmjs.com/package/@langchain/xai) | The Ask Ownique agent |
| **Capital One Nessie API** | "Pay with bank" checkout (practice bank accounts) |
| **Grok API** (SpaceXSI) | Ask Ownique, design descriptions, Grok Bot changelog |
| **Gemini API** (Google) | Copy detector judgment + Try It On |
| [Zod](https://zod.dev) | Tool input schemas |
| **Vultr**, Docker, Nginx, Certbot | Hosting |
| **GoDaddy Registry** | Domain |

## 🛠️ Sponsor tools
| Tool | How we use it |
|---|---|
| Cursor | Our core AI coding agent |
| Grok (xAI) | Ask Ownique agent, design descriptions + a Grok Bot automation |
| LangChain Deep Agents | Ask Ownique is a Deep Agent with Ownique tools |
| Solana | Ownership tokens + payments |
| MongoDB Atlas | Users, designs, reports |
| Gemini | Copy detector + Try It On |
| Tiger Data | Live sales dashboard |
| Vultr | Hosting |
| GoDaddy Registry | Our domain |

## 👥 Team
- Discord: _add usernames here_
