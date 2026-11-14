"use client";
// The Designer Ownership Transfer Declaration: legal name, review, accept, authority, third-party content.
import { DECLARATION_TEXT, DECLARATION_VERSION } from "@/lib/declaration";

export type DeclarationState = {
  legalName: string;
  reviewedDeclaration: boolean;
  acceptedDeclaration: boolean;
  authorityConfirmed: boolean;
  thirdPartyContent: boolean | null; // null = not answered yet
  thirdPartyDetails: string;
};

export const emptyDeclaration: DeclarationState = {
  legalName: "",
  reviewedDeclaration: false,
  acceptedDeclaration: false,
  authorityConfirmed: false,
  thirdPartyContent: null,
  thirdPartyDetails: "",
};

export const declarationComplete = (d: DeclarationState) =>
  d.legalName.trim().split(/\s+/).length >= 2 &&
  d.reviewedDeclaration && d.acceptedDeclaration && d.authorityConfirmed &&
  d.thirdPartyContent !== null && (!d.thirdPartyContent || d.thirdPartyDetails.trim().length >= 5);

export default function DeclarationFields({
  value, onChange, disabled,
}: { value: DeclarationState; onChange: (v: DeclarationState) => void; disabled?: boolean }) {
  const set = (patch: Partial<DeclarationState>) => onChange({ ...value, ...patch });
  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
      <legend className="px-1 text-sm font-semibold text-violet-900">Ownership transfer declaration</legend>

      <label className="block">
        <span className="text-sm font-medium">Your full legal name</span>
        <input value={value.legalName} onChange={(e) => set({ legalName: e.target.value })} autoComplete="name"
          placeholder="First and last name"
          className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-violet-500" />
        <span className="mt-1 block text-xs text-stone-500">Kept private and stored only with this agreement. Your public credit stays your creator profile.</span>
      </label>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Declaration · version {DECLARATION_VERSION}</p>
        <blockquote className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#ece3d9] bg-white p-4 font-serif text-sm leading-relaxed text-stone-800">
          “{DECLARATION_TEXT}”
        </blockquote>
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" className="mt-0.5 accent-violet-600" checked={value.reviewedDeclaration}
            onChange={(e) => set({ reviewedDeclaration: e.target.checked })} />
          <span>I have read and reviewed the ownership declaration above.</span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" className="mt-0.5 accent-violet-600" checked={value.acceptedDeclaration}
            onChange={(e) => set({ acceptedDeclaration: e.target.checked })} />
          <span>I accept the ownership declaration.</span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" className="mt-0.5 accent-violet-600" checked={value.authorityConfirmed}
            onChange={(e) => set({ authorityConfirmed: e.target.checked })} />
          <span>I confirm that I have the authority to transfer the rights to this design.</span>
        </label>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-medium">Does this design include anything you didn&apos;t create yourself?</p>
        <p className="text-xs text-stone-500">For example a stock photo, clip art, a licensed font, someone else&apos;s artwork, or AI output based on someone else&apos;s work.</p>
        <div className="flex gap-3">
          {([[false, "No, it's all mine"], [true, "Yes, some of it"]] as const).map(([v, label]) => (
            <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 ${value.thirdPartyContent === v ? "border-violet-600 bg-white" : "border-stone-300"}`}>
              <input type="radio" name="thirdParty" className="accent-violet-600" checked={value.thirdPartyContent === v}
                onChange={() => set({ thirdPartyContent: v })} />
              {label}
            </label>
          ))}
        </div>
        {value.thirdPartyContent && (
          <div className="space-y-1">
            <textarea value={value.thirdPartyDetails} onChange={(e) => set({ thirdPartyDetails: e.target.value })} rows={2}
              placeholder="What is it, and where is it from? Do you have a license?"
              className="w-full rounded-xl border border-stone-300 bg-white p-2" />
            <p className="rounded-lg bg-fuchsia-50 p-2 text-xs text-fuchsia-800">
              ⚠️ Third-party content needs a separate rights review. Your design will be listed, but it can&apos;t be bought until the review is cleared.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        You&apos;ll sign this declaration with your wallet (free, no payment). A declaration records your promise; it doesn&apos;t by
        itself prove that you are the author or owner of the design.
      </p>
    </fieldset>
  );
}

/** Adds the declaration fields + wallet signature to a form or JSON body. */
export async function signDeclaration(
  d: DeclarationState,
  signMessage: (m: Uint8Array) => Promise<Uint8Array>,
  encode: (b: Uint8Array) => string,
  prefix: (name: string) => string
) {
  const message = `${prefix(d.legalName)} at ${Date.now()}`;
  const signature = encode(await signMessage(new TextEncoder().encode(message)));
  return {
    legalName: d.legalName.replace(/\s+/g, " ").trim(),
    reviewedDeclaration: String(d.reviewedDeclaration),
    acceptedDeclaration: String(d.acceptedDeclaration),
    authorityConfirmed: String(d.authorityConfirmed),
    thirdPartyContent: String(Boolean(d.thirdPartyContent)),
    thirdPartyDetails: d.thirdPartyDetails,
    message,
    signature,
  };
}
