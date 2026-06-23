// src/app/api/offices/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requirePermission,
  handleError,
  readJson,
} from "@/lib/guard";
import { officeSchema } from "@/lib/enums";

export async function GET() {
  try {
    // Any authenticated user can list offices (needed for filters / selectors)
    await requirePermission("devices", "view");
    const offices = await db.office.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { devices: true, users: true, hospitals: true } } },
    });
    return Response.json({ offices });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only super admin can create offices — enforce via "users" full perm on super admin
    const { session } = await requirePermission("users", "full");
    if (session.officeId !== null) {
      return Response.json({ error: "ممنوع: فقط المدير العام" }, { status: 403 });
    }
    const body = await readJson(req);
    const parsed = officeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بىانات غير صالحة" },
        { status: 400 }
      );
    }
    const office = await db.office.create({ data: parsed.data });
    return Response.json({ office }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
