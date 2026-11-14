// Shared constants for "Design My Object" (browser + server).
export const MATERIALS = ["ceramic", "glass", "cotton / fabric", "wood", "metal", "plastic", "leather", "paper", "other"] as const;
export const POST_PREFIX = "Ownique: post object request";
export const replyPrefix = (requestId: string, designId: string) => `Ownique: suggest design ${designId} for request ${requestId}`;
export const SHORTLIST_SCOPE = "manage shortlist";
