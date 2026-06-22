// src/app/api/auth/login/route.ts — [FIX 4, 5]
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password";
import { createSession } from "@/lib/session";
import { handleError, readJson, GuardError } from "@/lib/guard";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    // [EDIT] login by username instead of email
    const username = (body?.username ?? "").toString().trim();
    const password = (body?.password ?? "").toString();
    if (!username || !password) {
      throw new GuardError(400, "اسم المستخدم وكلمة المرور مطقوبان");
    }
    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      throw new GuardError(401, "بيانات الدخول غير صحيحة");
    }
    // [FIX 4] bcrypt verify
    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      throw new GuardError(401, "بيانات الدخول غير صحيحة");
    }
    // Silent rehash migration from legacy plaintext
    if (needsRehash(user.password)) {
      const newHash = await hashPassword(password);
      await db.user.update({ where: { id: user.id }, data: { password: newHash } });
    }
    let perms: Record<string, string> = {};
    try {
      perms = JSON.parse(user.perms || "{}");
    } catch {
      perms = {};
    }
    // [FIX 5] signed JWT session in httpOnly cookie
    await createSession({
      userId: user.id,
      officeId: user.officeId,
      perms,
    });
    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        officeId: user.officeId,
        perms,
        phone: user.phone,
        department: user.department,
        // officeId === null is the super-admin marker (FIX 7). Surfacing it
        // here lets the SPA skip a second round-trip to /api/auth/me.
        isSuperAdmin: user.officeId === null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
