import { NextResponse } from "next/server";
import sharp from "sharp";
import { connectDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { getSessionAccount } from "@/lib/auth";

/** POST multipart { avatar } — owner only. Re-encoded to a 320px JPEG (removes hidden photo data). */
export async function POST(req: Request) {
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const f = (await req.formData()).get("avatar");
  if (!(f instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "Please choose a JPG, PNG or WebP image under 5MB." }, { status: 400 });
  let jpeg: Buffer;
  try {
    jpeg = await sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(320, 320, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "That image couldn't be read." }, { status: 400 });
  }
  await connectDb();
  await Account.updateOne({ _id: me._id }, { avatar: jpeg, hasAvatar: true });
  return NextResponse.json({ ok: true });
}
