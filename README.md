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
- Exact-copy blocking (the same image can't be uploaded twice)
- "How ownership works" policy page

## 🔜 Next to build (in Cursor, see `.cursorrules`)
1. Gemini: smarter copy detector + "Try It On" preview
2. Tiger Data: live dashboard
3. Report button + admin page
4. Grok Bot GitHub Action
5. Deploy on Vultr + GoDaddy domain

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
   - `VAULT_SECRET_KEY`: the private key of a **new, devnet-only** Phantom wallet that holds ownership tokens until they sell. Get free devnet SOL for it at faucet.solana.com. Never use a wallet with real money.
5. Start the site:
   ```
   npm run dev
   ```
6. Open http://localhost:3000
7. In Phantom: Settings → Developer Settings → switch to **Devnet**

## 🛠️ Sponsor tools
| Tool | How we use it |
|---|---|
| Cursor | Our core AI coding agent |
| Grok (xAI) | Writes design descriptions + a Grok Bot automation |
| Solana | Ownership tokens + payments |
| MongoDB Atlas | Users, designs, reports |
| Gemini | Copy detector + Try It On |
| Tiger Data | Live sales dashboard |
| Vultr | Hosting |
| GoDaddy Registry | Our domain |

## 👥 Team
- Discord: _add usernames here_
