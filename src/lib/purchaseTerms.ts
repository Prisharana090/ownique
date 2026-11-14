// 📜 Exclusive Design Purchase Agreement: design-specific terms (shared by browser + server, no secrets).
// Bump AGREEMENT_VERSION whenever the wording changes. Designer and buyer must accept the SAME version,
// and an amendment requires fresh acceptance from both (older records are kept, never edited).
export const AGREEMENT_VERSION = "2026-11-14.v1";
export const AGREEMENT_TITLE = "EXCLUSIVE DESIGN PURCHASE & COPYRIGHT OWNERSHIP TRANSFER AGREEMENT";
export const BUYER_ACCEPT_LABEL = "I have read and agree to the Exclusive Design Purchase Agreement.";
export const DEMO_ACCEPTANCE_LABEL = "Demo Agreement Acceptance — Not a Legal E-Signature Service";
export const LEGAL_REVIEW_NOTICE =
  "This document records the terms the parties agreed to on Ownique. It is pending qualified legal review, does not " +
  "independently guarantee copyright validity or ownership, and needs jurisdiction-specific review before commercial use. " +
  "Checkboxes, hashes and wallet signatures alone do not prove a legal signature, identity, consent, authorship, or an effective transfer.";
export const GOVERNING_LAW_MISSING = "NOT SPECIFIED — flagged for qualified legal review (not invented by Ownique).";

export type TermsInput = {
  designId: string;
  title: string;
  category: string;
  priceSol: number;
  priceUsd: number | null;
  designerAccount: string; // Ownique account (wallet) of the original creator
  designerUsername: string | null;
  governingLaw: string | null;
  isDemo: boolean;
};
export type TermsSection = { heading: string; body: string[] };

export function buildPurchaseTerms(t: TermsInput): TermsSection[] {
  const creator = t.designerUsername ? `${t.designerUsername} (Ownique account ${t.designerAccount})` : `Ownique account ${t.designerAccount}`;
  const price = `${t.priceSol} SOL${t.priceUsd != null ? ` (or US$${t.priceUsd} if paid by bank)` : ""}`;
  const s: TermsSection[] = [
    {
      heading: "1. Parties and Design",
      body: [
        `Seller ("Designer"): the original creator of the Design, ${creator}. The Designer's legal name is kept on file and included in the executed agreement given to both parties.`,
        `Buyer: the person who accepts this agreement with their full legal name and Ownique account.`,
        `Design: "${t.title}" (Design ID ${t.designId}, category: ${t.category}). Price: ${price}.`,
        `Agreement version: ${AGREEMENT_VERSION}.`,
      ],
    },
    {
      heading: "2. Exclusive Copyright Assignment (subject to execution)",
      body: [
        "Upon the Effective Transfer (Section 3), the Designer assigns to the Buyer, exclusively and worldwide, all copyright ownership rights the Designer holds in the Design, for their full duration, to the extent those rights are held by the Designer and are assignable under applicable law.",
        "The Design is sold only once. After the Effective Transfer no other person may purchase it on Ownique.",
      ],
    },
    {
      heading: "3. Conditions for an Effective Transfer",
      body: [
        "The transfer becomes effective only when ALL of these are met: (a) the full price is paid and the payment is verified; (b) the Designer and the Buyer have both accepted this same agreement version; (c) the Designer's ownership declaration is accepted and no third-party rights review is pending; and (d) this agreement is executed in a form valid under the governing law (for example, a signed written instrument where the law requires one).",
        "Until every condition is met, no copyright transfer is effective. Ownique records the parties' acceptances and payment; it does not itself execute the transfer.",
      ],
    },
    {
      heading: "4. Buyer Rights After the Effective Transfer",
      body: [
        "The Buyer may reproduce, modify, adapt, manufacture products bearing, commercially use, distribute, and sell products featuring the Design, and may license these rights to others.",
      ],
    },
    {
      heading: "5. Creator Attribution",
      body: [
        "The Designer remains credited as the original creator of the Design in Ownique's public records and Certificate of Creation, permanently. Attribution does not give the Designer any ownership after the Effective Transfer, and the Buyer is not required to print the credit on products.",
        "Any non-waivable moral rights of the Designer remain as provided by applicable law.",
      ],
    },
    {
      heading: "6. Designer Authority, Representations and Restrictions",
      body: [
        "The Designer states that they are the original creator of the Design or have the legal authority to transfer its rights; that they have disclosed any third-party content; and that they have not made, and will not make, any conflicting transfer, exclusive license or sale of the Design.",
        "After the Effective Transfer, the Designer will not commercially resell, redistribute, license or reuse the Design or close copies of it.",
      ],
    },
    {
      heading: "7. Third-Party Content",
      body: [
        "Third-party content (for example stock images, licensed fonts or another person's artwork) is not assigned by this agreement unless it is separately cleared. Designs that disclose third-party content cannot be sold until a separate rights review is completed.",
      ],
    },
    {
      heading: "8. Limitations",
      body: [
        "Ownique is a marketplace and record keeper, not a party to the assignment and not a law firm. Ownique does not guarantee that copyright exists in the Design, that it is valid or original, or that it can be registered, and this agreement grants no trademark rights.",
        "The Designer can only assign rights the Designer actually holds. This agreement is not a copyright registration.",
        LEGAL_REVIEW_NOTICE,
      ],
    },
    {
      heading: "9. Payment, Delivery and Records",
      body: [
        `Price: ${price}. The full-quality file is delivered to the Buyer after payment is verified. Sales are final once the file is delivered.`,
        "Ownique stores both acceptances with server-generated timestamps, the exact text of this agreement and its integrity hash. Records are never silently changed or deleted.",
      ],
    },
    {
      heading: "10. Governing Law",
      body: [t.governingLaw ? `This agreement is governed by the laws of ${t.governingLaw}.` : `Governing law: ${GOVERNING_LAW_MISSING}`],
    },
    {
      heading: "11. Amendments",
      body: [
        "If these terms change, a new agreement version is created and both parties must accept it again. Earlier versions, acceptances and generated documents are kept unchanged.",
      ],
    },
  ];
  if (t.isDemo)
    s.push({
      heading: "12. Test Purchase Notice",
      body: [
        `${DEMO_ACCEPTANCE_LABEL}. This is a TEST purchase on a prototype (Solana devnet / Capital One Nessie sandbox). No real money moves, and the transfer is never marked legally effective.`,
      ],
    });
  return s;
}

export const termsToText = (sections: TermsSection[]) =>
  [AGREEMENT_TITLE, ...sections.flatMap((s) => [s.heading, ...s.body])].join("\n");

/** The exact sentence the buyer's wallet signs: binds the version, the terms hash, the design and the legal name. */
export const purchaseAcceptancePrefix = (version: string, hash: string, designId: string, legalName: string) =>
  `Ownique purchase agreement ${version} ${hash} for design ${designId} accepted by ${legalName.trim()}`;
