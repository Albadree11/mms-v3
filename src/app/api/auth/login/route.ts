// src/app/api/auth/login/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password";
import { createSession } from "@/lib/session";
import { handleError, readJson, GuardError } from "@/lib/guard";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req) as any;
    const email    = (body?.email    ?? "").toString().trim().toLowerCase().slice(0, 254);
    const password = (body?.password ?? "").toString().slice(0, 128);
    if (!email || !password) throw new GuardError(400, "البريد وكلمة المرور مطلوبان");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GuardError(400, "صيغة البريد غير صحيحة");

    const snap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snap.empty) throw new GuardError(401, "بيانات الدخول غير صحيحة");

    const userDoc  = snap.docs[0];
    const userData = userDoc.data();

    const ok = await verifyPassword(password, userData.password);
    if (!ok) throw new GuardError(401, "بيانات الدخول غير صحيحة");

    if (needsRehash(userData.password)) {
      await userDoc.ref.update({ password: await hashPassword(password) });
    }

    const perms: Record<string, string> = userData.perms ?? {};

    await createSession({
      userId:   userDoc.id,
      officeId: userData.officeId ?? null,
      perms,
    });

    return Response.json({
      user: {
        id:           userDoc.id,
        name:         userData.name,
        email:        userData.email,
        officeId:     userData.officeId ?? null,
        perms,
        phone:        userData.phone ?? "",
        department:   userData.department ?? null,
        isSuperAdmin: userData.officeId == null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
