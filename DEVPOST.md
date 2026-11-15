# Ownique: Devpost write-up + 2-minute pitch

Copy each section into Devpost. Replace anything in [brackets].
**Deadline: Sun Nov 15, 2026, 8:30 AM EST.** In-person judging 9:30 AM – 2 PM (2 minutes max).

---

## Tagline
One design. One owner. Credit forever.

## 🏁 Tracks we're entering
**Main track:** Business & Enterprise

**Sponsor tracks (opt into these on Devpost):**
| Track | Why Ownique fits |
|---|---|
| Amazon: Best Practical AI Innovation | Practical AI that protects real creators: Ask Ownique answers questions with live data and checks designs for brand look-alikes; Gemini helps the copy detector catch stolen re-uploads |
| LangChain: Best use of Deep Agents | Ask Ownique is a Deep Agent (running on Gemini) with 5 custom tools: search_designs, get_design, get_ownership_record, lookup_terms, get_platform_stats |
| MLH: Best Use of Solana | Wallet identity, wallet-signed agreements, on-chain payment verification, 1-of-1 Metaplex Core ownership tokens with the creator recorded forever |
| MLH: Best Use of MongoDB Atlas | Accounts, designs (private originals + watermarked previews), agreements, reviews, demo orders |
| MLH: Best Use of Tiger Data | Hypertable of every event + per-minute continuous aggregate powering a live dashboard |
| MLH: Best Use of Gemini API | Powers the Ask Ownique agent and judges borderline copies in the copy detector |
| Best Rookie Hack | (only if this is your first hackathon) |

> Not entered (not set up tonight): Capital One Nessie (the "Pay with bank" code exists but needs a `NESSIE_API_KEY`), Grok/xAI (needs an `XAI_API_KEY`), Vultr (not deployed), GoDaddy domain.

## Inspiration
Designers sell their work online and lose control of it. The same design gets sold again and again, copied, or reposted without credit. Buyers like small sellers who want a unique look for *their* product can never be sure no one else has the same design. We wanted a marketplace where **owning a design actually means something**.

## The problem
- Designers can't prove they made something, and they lose credit once it spreads.
- Buyers can't be sure they truly own a design, or that it won't be sold to someone else tomorrow.
- Stolen and copied designs are everywhere, and marketplaces rarely catch them.

## What it does
Ownique is a design marketplace where **every design sells exactly once**.
- **Accounts:** sign up as a **Buyer** or a **Designer** (one role, permanent), with public profiles.
- **Designers** upload as many designs as they like: artwork, title, description, price in **US$ or SOL**, product, style and material. Their original file stays **private**; shoppers only see a **watermarked preview**. They can edit unsold listings any time.
- Before a design can sell, the designer signs an **Ownership Transfer Declaration** with their wallet.
- Each design becomes a **1-of-1 ownership token on Solana**, with the designer recorded **forever** as the creator.
- **Try It On:** buyers pick a product template (T-shirt, mug, plant pot, glass, can, notebook, wall) or upload a photo of their own product. The design is placed and warped onto it, clipped to the printable area (detected automatically), with color customization. It all runs in the browser.
- **Buying:** the buyer reads and accepts an **Exclusive Design Purchase Agreement** for that exact design, pays in SOL, and the server **verifies the payment on Solana**, marks the design sold (only once, even if two people click at the same moment) and **moves the ownership token to the buyer**. Both sides get a PDF of the agreement.
- Only the owner can download the full-quality file. Everyone else sees the watermarked preview.
- **Verified reviews:** only buyers who actually purchased a designer's work can rate them.
- A **copy detector** blocks re-uploads of existing designs, including resized or edited copies, with Gemini judging the close calls.
- **Ask Ownique**, a LangChain Deep Agent, answers questions using live shop data, ownership records and stats.
- A **live dashboard** (Tiger Data) shows views, try-ons, sales and blocked copies in real time.
- **Demo Mode** on the designer dashboard: a sample order with a fictional buyer where the designer accepts the agreement, simulates buyer acceptance and payment, and approves the ownership transfer, all clearly labeled as a demonstration.

## How we built it
- **Next.js 15 + TypeScript + Tailwind**: the website
- **Solana (devnet)**: wallet login and signatures, SOL payments verified on-chain, Metaplex Core 1-of-1 ownership tokens held by a vault wallet (like escrow) until sold
- **MongoDB Atlas**: accounts, designs, agreements (tamper-protected records), reviews, demo orders
- **LangChain Deep Agents + Gemini**: Ask Ownique with Ownique-specific tools
- **Gemini API**: the agent's model + copy-detector judgment
- **Tiger Data**: every event goes into a TimescaleDB hypertable, with a per-minute continuous aggregate powering the live dashboard
- **sharp + pdf-lib**: watermarked previews and agreement PDFs
- **Cursor** and **Claude**: AI coding assistants

## How we used each sponsor tool
| Tool | How we used it |
|---|---|
| LangChain Deep Agents | Ask Ownique: a Deep Agent that decides when to search the shop, read ownership records, look up our terms or pull live stats |
| Gemini API | The agent's model (free tier, with automatic fallback between models) and the copy detector's "is this the same design?" check |
| Solana | Wallet identity, wallet-signed declarations, verified SOL payments, 1-of-1 Metaplex Core ownership tokens with on-chain creator credit |
| MongoDB Atlas | Accounts, designs, private originals, agreements, reviews, demo orders |
| Tiger Data | Hypertable of events + continuous aggregate → live dashboard |

## Trust & safety
- **Designer Ownership Transfer Declaration:** legal name, versioned declaration, authority confirmation, signed with the designer's wallet. Without it, a design can't be bought. Third-party content is flagged for a rights review.
- **Exclusive Design Purchase Agreement:** both parties must accept the same version; acceptances, the exact text and its hash are stored and can't be edited or deleted. If a price changes, the buyer must re-accept.
- Payments are verified on-chain, and each payment can only be used once.
- Private originals; watermarked previews for everyone else.
- **Certificate of Creation** for every design: creator, time, file fingerprint, ownership token, owner, payment.
- Copy detection at three levels: exact file, look-alike (perceptual hash), and AI judgment (Gemini).
- Report button, verified-purchase-only reviews, and plain-language Copyright, Trademark & Privacy terms.
- Everything runs on Solana **devnet**: no real money moves. Agreements are clearly marked as records pending legal review, not legal advice.

## Challenges we ran into
[Write 2–3 real ones, e.g. making sure a design can only ever sell once even with simultaneous clicks; getting the AI agent to work on Gemini's free tier (thought signatures, quotas); clipping Try It On designs to the real printable area of a product.]

## Accomplishments we're proud of
- A full buy flow where ownership really moves on-chain, and can only happen once.
- Agreements that both parties accept, stored tamper-proof, with a PDF for each side.
- Try It On makes buying a design feel like shopping for a real product.

## What we learned
[e.g. how Solana transactions are verified, how AI agents decide which tools to use, how time-series data powers live dashboards.]

## What's next
- Pay with bank (Capital One Nessie), already built, needs keys
- Royalties for designers when owners sell products using the design
- Searching the wider internet for stolen copies, not just our own marketplace
- Mainnet launch with real escrow on-chain, and qualified legal review of the agreements

## Rubric notes (Best Overall)
- **Creativity:** "sold once, credited forever" is a new rule for design marketplaces, enforced by code, not trust.
- **Utility:** small sellers get unique designs; designers get paid and keep their name on their work. Every flow in the demo works end to end.
- **Charity:** protects independent and student artists from theft and uncredited reuse.
- **Avidity:** built end to end in 36 hours, with accounts, agreements, an AI agent, on-chain ownership and a live dashboard.

## Credits
See the **Credits** section in our README for every library and service we used.

## Links
- GitHub: https://github.com/Prisharana090/ownique
- Demo video (optional, max 2 min): [YouTube link]
- Discord usernames: [add every teammate's Discord username here]

---

# 🎤 2-minute pitch script (about 260 words)

**0:00 · The problem**
"Hi, I'm [name]. Designers sell their work online, and then it gets resold, copied, or reposted without credit. And if you're a small seller buying a design for your product, you have no idea who else owns the same one."

**0:20 · The idea**
"Ownique is a design marketplace with one rule: every design sells once, to one owner, and the designer is credited forever."

**0:30 · Designer lists it** *(upload page)*
"I upload my design, set my price, and sign my ownership declaration with my wallet. Solana mints a one-of-a-kind ownership token with my name on it, permanently. My original file stays private; shoppers only see a watermarked preview."

**0:55 · Buyer tries it on** *(Try It On)*
"Julia sells mugs. She picks a mug, and my design wraps onto it, only inside the printable area. She can even change its colors."

**1:10 · Ownership changes hands** *(Dashboard → Demo Mode)*
"Here's the hand-over. Both sides accept the same agreement, payment is confirmed, and I approve the transfer. The design is now sold, it can never be bought again, and I'm still credited as the creator. Both of us get the signed agreement as a PDF."

**1:35 · Smart help + live data** *(Ask Ownique, then dashboard)*
"Ask Ownique is our AI agent. Ask it how many try-ons we've had, and it pulls the real number from our live Tiger Data dashboard."

**1:50 · Close**
"Ownique: one design, one owner, credit forever. Thank you!"

### Demo checklist
- [ ] Run the fast version: VS Code → NPM Scripts → ▶ **demo** (or `npm run demo`)
- [ ] Logged in as a **Designer**; wallet connected (Phantom on **devnet**, or **Ownique Demo Wallet (devnet)** from Select Wallet) and linked on your profile
- [ ] One design uploaded and buyable (shows **Available**, not "Awaiting designer confirmation")
- [ ] Dashboard → **Demo Mode** freshly reset (↺ Reset Demo) before you present
- [ ] Ask Ownique tested once right before (free tier can pause if it's busy)
- [ ] Try It On open on the mug template
- [ ] Backup: screenshots of each step in case Wi-Fi is slow
- [ ] Practiced 3 times, under 2 minutes
