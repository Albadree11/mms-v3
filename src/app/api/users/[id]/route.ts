// src/app/api/users/[id]/route.ts — [FIX A3] edit/delete users
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { userSchema, PERM_MODULES, PERM_LEVELS } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  isSuperAdmin,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";
import { hashPassword } from "@/lib/password";

/** Keep only known modules/levels — never trust raw perms from the body. */
function sanitizePerms(raw?: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const m of PERM_MODULES) {
    const v = raw?.[m];
    if (v && (PERM_LEVELS as readonly string[]).includes(v)) clean[m] = v;
  }
  return clean;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("users", "edit");
    const { id } = await params;
    const userId = Number(id);
    if (!userId) throw new GuardError(400, "معرّف غير صالح");

    const body = await readJson(req);
    const parsed = userSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    // Normal admins can only edit users within their own office. Super admin
    // can edit anyone.
    const scope = officeScope(session);
    const target = await db.user.findFirst({
      where: { id: userId, ...scope },
      select: { id: true, officeId: true },
    });
    if (!target) throw new GuardError(404, "المستخدم غير موجود");

    const data: Record<string, unknown> = {};
    if (typeof parsed.data.name === "string") data.name = parsed.data.name;
    if (typeof parsed.data.username === "string" && parsed.data.username)
      data.username = parsed.data.username;
    if (typeof parsed.data.email === "string")
      data.email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
    if (typeof parsed.data.phone === "string") data.phone = parsed.data.phone;
    if (typeof parsed.data.department === "string")
      data.department = parsed.data.department;

    // Password: only update if a non-empty value is supplied; always re-hash.
    if (parsed.data.password) {
      data.password = await hashPassword(parsed.data.password);
    }

    // Perms: sanitized. A normal admin cannot grant a permission level higher
    // than their own for any module (no privilege escalation).
    if (parsed.data.perms) {
      const requested = sanitizePerms(parsed.data.perms);
      if (!isSuperAdmin(session)) {
        const rank: Record<string, number> = { none: 0, view: 1, edit: 2, full: 3 };
        for (const m of PERM_MODULES) {
          const want = requested[m];
          if (!want) continue;
          const mine = session.perms[m] ?? "none";
          if (rank[want] > (rank[mine] ?? 0)) {
            throw new GuardError(
              403,
              "لا يمكنك منح صلاحية اعلى من صلاحيتك"
            );
          }
        }
      }
      data.perms = JSON.stringify(requested);
    }

    // officeId can only be changed by a super admin, to an existing office (or
    // null for promoting to super admin). Normal admins can never move a user.
    if (isSuperAdmin(session) && "officeId" in body) {
      const newOffice = parsed.data.officeId ?? null;
      if (newOffice !== null) {
        const office = await db.office.findUnique({
          where: { id: newOffice },
          select: { id: true },
        });
        if (!office) throw new GuardError(400, "المكتب المطلوب غير موجود");
      }
      data.officeId = newOffice;
    }

    const user = await db.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        department: true,
        officeId: true,
      },
    });
    return Response.json({ user });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("users", "full");
    const { id } = await params;
    const userId = Number(id);
    if (!userId) throw new GuardError(400, "معرّف غير صالح");

    // Cannot delete yourself (prevents accidental lockout).
    if (userId === session.userId) {
      throw new GuardError(400, "لا يمكنك حذف حسابك الحالي");
    }

    const scope = officeScope(session);
    const target = await db.user.findFirst({
      where: { id: userId, ...scope },
      select: { id: true, officeId: true },
    });
    if (!target) throw new GuardError(404, "المستخدم غير موجود");

    // Only a super admin may delete another super admin.
    if (target.officeId === null && !isSuperAdmin(session)) {
      throw new GuardError(403, "لا تملك صلاحية حذف المدير العام");
    }

    await db.user.delete({ where: { id: userId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
