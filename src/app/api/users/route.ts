// src/app/api/users/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { userSchema, PERM_MODULES, PERM_LEVELS } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, GuardError,
} from "@/lib/guard";
import { hashPassword } from "@/lib/password";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "view");
    const officeFilter = getOfficeFilter(session, new URL(req.url).searchParams.get("office"));

    let q: FirebaseFirestore.Query = db.collection("users");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    q = q.orderBy("createdAt", "asc");
    const snap = await q.get();

    // Never return password hash
    const users = snap.docs.map((doc) => {
      const { password: _pw, ...rest } = doc.data() as any;
      return serializeTimestamps({ id: doc.id, ...rest });
    });

    return Response.json({ users });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "edit");
    const body = await readJson(req) as any;
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    if (!parsed.data.password) {
      throw new GuardError(400, "كلمة المرور مطلوبة عند الإنشاء");
    }

    // Check email uniqueness (Firestore has no unique constraint)
    const emailCheck = await db.collection("users")
      .where("email", "==", parsed.data.email.toLowerCase())
      .limit(1)
      .get();
    if (!emailCheck.empty) {
      return Response.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    }

    const password = await hashPassword(parsed.data.password);

    // Sanitize perms — only known modules/levels
    const cleanPerms: Record<string, string> = {};
    for (const m of PERM_MODULES) {
      const v = parsed.data.perms?.[m];
      if (v && (PERM_LEVELS as readonly string[]).includes(v)) {
        cleanPerms[m] = v;
      }
    }

    const ref = await db.collection("users").add({
      name:       parsed.data.name,
      email:      parsed.data.email.toLowerCase(),
      password,
      phone:      parsed.data.phone ?? null,
      department: parsed.data.department ?? null,
      officeId,
      perms:      cleanPerms,
      isSuperAdmin: false,
      createdAt:  Timestamp.now(),
    });

    const { password: _pw, ...safeData } = {
      id: ref.id, ...parsed.data,
      officeId, perms: cleanPerms, isSuperAdmin: false,
    };
    return Response.json({ user: serializeTimestamps(safeData) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) return Response.json({ error: "المستخدم غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    const body = await readJson(req) as any;
    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (body.name)       update.name = body.name;
    if (body.phone)      update.phone = body.phone;
    if (body.department) update.department = body.department;
    if (body.perms)      update.perms = body.perms;
    if (body.password) {
      update.password = await hashPassword(body.password as string);
    }

    await db.doc(`users/${id}`).update(update);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "full");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    await db.doc(`users/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
