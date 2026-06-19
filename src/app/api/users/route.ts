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
      return Response.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    if (!parsed.data.password) throw new GuardError(400, "كلمة المرور مطلوبة عند الإنشاء");

    const emailCheck = await db.collection("users")
      .where("email", "==", parsed.data.email.toLowerCase()).limit(1).get();
    if (!emailCheck.empty) {
      return Response.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    }

    const password = await hashPassword(parsed.data.password);

    const cleanPerms: Record<string, string> = {};
    for (const m of PERM_MODULES) {
      const v = parsed.data.perms?.[m];
      if (v && (PERM_LEVELS as readonly string[]).includes(v)) cleanPerms[m] = v;
    }

    const ref = await db.collection("users").add({
      name:       parsed.data.name,
      email:      parsed.data.email.toLowerCase(),
      password,
      phone:      parsed.data.phone ?? null,
      department: parsed.data.department ?? null,
      perms:      cleanPerms,
      officeId,
      createdAt:  Timestamp.now(),
    });

    return Response.json(
      {
        user: serializeTimestamps({
          id: ref.id,
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          phone: parsed.data.phone ?? null,
          department: parsed.data.department ?? null,
          perms: cleanPerms,
          officeId,
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "edit");
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new GuardError(400, "id مطلوب");

    const body = await readJson(req) as any;

    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) throw new GuardError(404, "المستخدم غير موجود");

    const officeFilter = getOfficeFilter(session);
    if (officeFilter && snap.data()!.officeId !== officeFilter) {
      throw new GuardError(404, "المستخدم غير موجود");
    }

    const update: Record<string, unknown> = {};

    if (body?.name)          update.name       = String(body.name).trim();
    if (body?.phone != null) update.phone      = body.phone ? String(body.phone).trim() : null;
    if (body?.department)    update.department = String(body.department).trim();

    if (body?.password) {
      update.password = await hashPassword(String(body.password));
    }

    if (body?.perms && typeof body.perms === "object") {
      const cleanPerms: Record<string, string> = {};
      for (const m of PERM_MODULES) {
        const v = body.perms[m];
        if (v && (PERM_LEVELS as readonly string[]).includes(v)) cleanPerms[m] = v;
      }
      update.perms = cleanPerms;
    }

    if (Object.keys(update).length === 0) throw new GuardError(400, "لا توجد حقول للتحديث");

    update.updatedAt = Timestamp.now();
    await db.doc(`users/${id}`).update(update);

    const { password: _pw, ...rest } = { ...snap.data(), ...update } as any;
    return Response.json({ user: serializeTimestamps({ id, ...rest }) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "full");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new GuardError(400, "id مطلوب");

    if (id === session.userId) throw new GuardError(400, "لا يمكنك حذف حسابك الخاص");

    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) throw new GuardError(404, "المستخدم غير موجود");

    const officeFilter = getOfficeFilter(session);
    if (officeFilter && snap.data()!.officeId !== officeFilter) {
      throw new GuardError(404, "المستخدم غير موجود");
    }

    await db.doc(`users/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
