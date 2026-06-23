// src/app/api/users/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { userSchema, PERM_MODULES, PERM_LEVELS } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";
import { hashPassword } from "@/lib/password";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "view");
    const where = officeScope(session, new URL(req.url).searchParams.get("office"));
    const users = await db.user.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        department: true,
        officeId: true,
        perms: true,
        createdAt: true,
      },
    });
    const withParsedPerms = users.map((u) => {
      let perms: Record<string, string> = {};
      try {
        perms = JSON.parse(u.perms || "{}");
      } catch {
        perms = {};
      }
      return { ...u, perms };
    });
    return Response.json({ users: withParsedPerms });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("users", "edit");
    const body = await readJson(req);
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
    const password = await hashPassword(parsed.data.password);
    // sanitize perms — only known modules/levels
    const cleanPerms: Record<string, string> = {};
    for (const m of PERM_MODULES) {
      const v = parsed.data.perms?.[m];
      if (v && (PERM_LEVELS as readonly string[]).includes(v)) {
        cleanPerms[m] = v;
      }
    }
    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
        password,
        phone: parsed.data.phone,
        department: parsed.data.department,
        officeId,
        perms: JSON.stringify(cleanPerms),
      },
      select: { id: true, name: true, username: true, email: true, officeId: true },
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
