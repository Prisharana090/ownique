// 📜 Designer Ownership Transfer Declaration (shared by the browser and the server).
// Bump the version whenever the wording changes; every acceptance stores the version it agreed to.
// Same version as the Exclusive Design Purchase Agreement: designer and buyer must accept the same version.
import { AGREEMENT_VERSION } from "./purchaseTerms";
export const DECLARATION_VERSION = AGREEMENT_VERSION;

export const DECLARATION_TEXT =
  "I confirm that I am the original creator of this design or have the necessary legal authority to transfer its rights. " +
  "I understand that this design is being offered for an exclusive sale. If a purchase is completed and the ownership " +
  "transfer becomes effective under the executed agreement, I will transfer the agreed copyright ownership rights to the " +
  "buyer and will not commercially resell, redistribute, or reuse the transferred design.";

export const CONFIRMATION_REQUIRED = "Designer ownership confirmation required.";
export const REACCEPT_REQUIRED =
  "The agreement was updated. The designer must review and accept the new version before this design can be sold.";
export const RIGHTS_REVIEW_REQUIRED =
  "This design includes third-party content that needs a separate rights review before it can be sold.";

/** The exact sentence the designer's wallet signs. It binds their legal name and the declaration version. */
export const declarationPrefix = (legalName: string, version = DECLARATION_VERSION) =>
  `Ownique ownership declaration ${version} accepted by ${legalName.trim()}`;

export const cleanLegalName = (name: string) => name.replace(/\s+/g, " ").trim();
export const isValidLegalName = (name: string) => {
  const n = cleanLegalName(name);
  return n.length >= 3 && n.length <= 100 && /\p{L}/u.test(n) && n.includes(" ");
};
