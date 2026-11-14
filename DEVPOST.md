# Ownique: Devpost write-up + 2-minute pitch

Copy each section into Devpost. Replace anything in [brackets].

---

## Tagline
One design. One owner. Credit forever.

## 🏁 Tracks we're entering
**Main track:** Business & Enterprise

**Sponsor tracks (opt into all of these on Devpost):**
| Track | Why Ownique fits |
|---|---|
| Amazon: Best Practical AI Innovation | Practical AI that protects real creators: Ask Ownique checks designs for brand look-alikes before listing; the copy detector blocks stolen re-uploads; Try It On previews products |
| LangChain: Best use of Deep Agents | Ask Ownique is a Deep Agent with 5 custom tools: search_designs, get_design, get_ownership_record, lookup_terms, get_platform_stats, plus image checks |
| Capital One: Best use of Nessie | "Pay with bank" checkout: buyers without crypto pay the designer bank-to-bank through Nessie practice accounts, and ownership still moves on Solana |
| MLH: Best Use of Solana | Wallet identity, on-chain payment verification, 1-of-1 Metaplex Core ownership tokens with the creator recorded forever |
| MLH: Best Use of MongoDB Atlas | Users, designs (with images), reports |
| MLH: Best Use of Tiger Data | Hypertable of every event + per-minute continuous aggregate powering a live dashboard |
| MLH: Best Use of Gemini API | Copy detector judgment + Try It On realistic previews |
| MLH: SpaceXSI raffle (Cursor + Grok Bot) | Grok powers Ask Ownique + descriptions; Grok Bot GitHub Action writes our changelog |
| MLH: Best Use of Vultr | Production hosting (Docker + Nginx + HTTPS) |
| MLH: Best Domain from GoDaddy Registry | [yourdomain] |
| Best Rookie Hack | (only if this is your first hackathon) |

## Inspiration
Designers sell their work online and lose control of it. The same design gets sold again and again, copied, or reposted without credit. Buyers like small sellers who want a unique look for *their* product can never be sure no one else has the same design. We wanted a marketplace where **owning a design actually means something**.

## The problem
- Designers can't prove they made something, and they lose credit once it spreads.
- Buyers can't be sure they truly own a design, or that it won't be sold to someone else tomorrow.
- Stolen and copied designs are everywhere, and marketplaces rarely catch them.

## What it does
Ownique is a design marketplace where **every design sells exactly once**.
- **Designers** upload original work, agree to clear ownership rules, and set a price in SOL. Grok writes the description.
- Each design becomes a **1-of-1 ownership token on Solana**, with the designer's wallet stored on-chain **forever** as the creator.
- **Buyers** can **Try It On**: upload a photo of their own cup, glasses, or shirt, and Gemini looks at both images and places the design where it fits best, with a styling tip (and a photorealistic render on a paid Gemini plan).
- When a buyer pays, the server **verifies the payment on Solana**, marks the design sold (only once, even if two people click at the same moment), and **moves the ownership token to the buyer's wallet**.
- Only the owner can download the full-quality file, by signing a free message with their wallet. Everyone else sees a watermarked preview.
- A **copy detector** blocks re-uploads of designs that already exist, including resized or edited copies, with Gemini judging the close calls.
- A **live dashboard** shows views, try-ons, sales, and blocked copies in real time.

## How we built it
- **Cursor**: our core AI coding agent, with a `.cursorrules` file describing the project and hackathon rules
- **Next.js 15 + TypeScript + Tailwind**: the website
- **Solana (devnet)**: Phantom wallet login, SOL payments verified on-chain, Metaplex Core 1-of-1 ownership tokens held by a vault wallet (like escrow) until sold
- **MongoDB Atlas**: users, designs (with images), and reports
- **Gemini API**: copy detector (compares two images) + Try It On (image editing model)
- **Grok (xAI)**: writes each design's description and tags, and our **Grok Bot**, a GitHub Action that turns every push into a plain-English changelog entry (and posts it to Discord)
- **Tiger Data**: every event goes into a TimescaleDB hypertable, with a per-minute continuous aggregate powering the live dashboard
- **Vultr**: hosting, with a Docker image + Nginx + HTTPS
- **GoDaddy Registry**: our domain, [yourdomain]

## How we used each sponsor tool
| Tool | How we used it |
|---|---|
| Cursor | Core AI coding agent for the whole build (see `.cursorrules`) |
| LangChain Deep Agents | Ask Ownique is a Deep Agent with Ownique-specific tools |
| Grok Bot | Powers the Ask Ownique agent (incl. brand look-alike checks), writes design descriptions in-app; GitHub Action summarizes every push into `CHANGELOG.md` + Discord |
| Gemini API | Judges whether two images are the same design; looks at product photos to place designs in Try It On |
| Solana | Wallet identity, verified SOL payments, 1-of-1 Metaplex Core ownership tokens with on-chain creator credit |
| MongoDB Atlas | Users, designs, images, reports |
| Capital One Nessie | "Pay with bank" checkout with practice bank accounts |
| Tiger Data | Hypertable of events + continuous aggregate → live dashboard |
| Vultr | Production hosting (Docker + Nginx + Certbot) |
| GoDaddy Registry | [yourdomain] |

## Trust & safety
- Before checkout, buyers see an **Exclusive Ownership Terms** screen for that exact design: what they're getting (exclusive copyright transfer, commercial use, reproduce, modify, manufacture, sell), designer credit, and one-owner rules.
- Designers and buyers each tick 5 clear confirmations before listing or buying, and designers **sign their originality agreement with their wallet**, so nobody can list designs in someone else's name.
- Payments are verified on-chain, and each payment can only be used once.
- Watermarked previews; the full file goes only to the verified owner.
- Every design has a printable **Certificate of Creation**: creator wallet, exact time, file fingerprint, Solana ownership token, current owner, and payment record.
- Copy detection at three levels: exact file, look-alike (perceptual hash), and AI judgment (Gemini).
- A Report button hides a design immediately while it's reviewed.
- **Ask Ownique**, a Grok-powered chat assistant, answers questions and checks designs for look-alikes of famous brand logos and characters before they're listed.
- Plain-language **Copyright, Trademark & Privacy** terms on the policy page.

## Challenges we ran into
[Write 2–3 real ones, e.g. getting the ownership token transfer and payment check to work together, tuning the copy detector so resized copies are caught but different designs aren't.]

## Accomplishments we're proud of
- A full buy flow where ownership really moves on-chain, and can only happen once.
- Try It On makes buying a design feel like shopping for a real product.

## What we learned
[e.g. how Solana transactions are verified, how time-series data powers live dashboards, how to prompt image models.]

## What's next
- Royalties for designers when owners sell products using the design
- Searching the wider internet for stolen copies, not just our own marketplace
- Mainnet launch with real escrow on-chain

## Rubric notes (Best Overall)
- **Creativity:** "sold once, credited forever" is a new rule for design marketplaces, enforced by code, not trust.
- **Utility:** small sellers get unique designs; designers get paid and keep their name on their work.
- **Charity:** protects independent and student artists from theft and uncredited reuse.
- **Avidity:** built end to end in 36 hours, using 8 sponsor tools in real, visible ways.

## Credits
See the **Credits** section in our README for every library and service we used.

## Links
- Live site: [https://yourdomain]
- GitHub: https://github.com/Prisharana090/ownique
- Demo video (optional, max 2 min): [YouTube link]
- Discord usernames: [add every teammate's Discord username here]

---

# 🎤 2-minute pitch script (about 270 words)

**0:00 · The problem**
"Hi, I'm [name]. Designers sell their work online, and then it gets resold, copied, or reposted without credit. And if you're a small seller buying a design for your product, you have no idea who else owns the same one."

**0:20 · The idea**
"Ownique is a design marketplace with one rule: every design sells once, to one owner, and the designer is credited forever."

**0:30 · Designer lists it** *(upload page)*
"I upload my design, and I sign my originality agreement with my wallet. Solana mints a one-of-a-kind ownership token with my name on it, permanently. Not sure it's original? Ask Ownique, our LangChain agent on Grok, checks it against famous brand logos first."

**0:55 · Buyer tries it on** *(hold up a real cup)*
"Julia sells cups. She snaps a photo of her cup, and Gemini sees it's a mug and places my design right where it fits."

**1:10 · Buyer owns it** *(click Buy)*
"She pays in SOL, or straight from her bank with Capital One's Nessie, no crypto needed. Ownership moves to her wallet, live, and only she can download the full file."

**1:30 · The magic moment** *(re-upload the same design)*
"Now watch me try to sell it again... blocked. Even resized copies get caught."

**1:40 · Proof + live data** *(Certificate, then dashboard)*
"Every design gets a free Certificate of Creation, proof of who made it and when. And every view, sale, and blocked copy streams live into Tiger Data."

**1:55 · Close**
"Ownique: one design, one owner, credit forever. Thank you!"

### Demo checklist
- [ ] Two wallets in Phantom (designer + buyer), both on **devnet** with free SOL from faucet.solana.com
- [ ] Shop full of designs (`npm run seed`), plus "Sunrise Petals" as a sold example
- [ ] A real cup + a photo of it on your laptop
- [ ] The design file you'll re-upload for the "blocked" moment
- [ ] Certificate + dashboard open in other tabs
- [ ] Backup: if Wi-Fi is slow, show the already-sold "Sunrise Petals" design and its Certificate
- [ ] Practiced 3 times, under 2 minutes
