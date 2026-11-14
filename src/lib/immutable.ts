// Protects legal/audit records: no deletes, and updates may only touch an allow-list of status fields.
import type { Schema } from "mongoose";

const top = (k: string) => k.split(".")[0];

export function protectRecords(schema: Schema, mutable: string[], label: string) {
  const allowed = new Set([...mutable, "updatedAt", "createdAt"]);
  const refuseDelete = async function () {
    throw new Error(`${label} records are permanent and can't be deleted.`);
  };
  for (const op of ["deleteOne", "deleteMany", "findOneAndDelete", "findOneAndReplace", "replaceOne"] as const)
    schema.pre(op, { document: true, query: true } as never, refuseDelete as never);

  const checkUpdate = async function (this: { getUpdate: () => Record<string, unknown> | null }) {
    const u = this.getUpdate() ?? {};
    for (const [k, v] of Object.entries(u)) {
      const keys = k.startsWith("$") ? Object.keys((v as object) ?? {}) : [k];
      if (k === "$unset" || k === "$rename") throw new Error(`${label}: ${k} is not allowed.`);
      for (const f of keys) if (!allowed.has(top(f))) throw new Error(`${label}: "${f}" can't be changed after acceptance.`);
    }
  };
  for (const op of ["updateOne", "updateMany", "findOneAndUpdate"] as const) schema.pre(op, checkUpdate as never);

  schema.pre("save", async function () {
    if (this.isNew) return;
    const bad = this.modifiedPaths().filter((p) => !allowed.has(top(p)));
    if (bad.length) throw new Error(`${label}: ${bad.join(", ")} can't be changed after acceptance.`);
  });
}
