// src/app/api/hospitals/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hospitalSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    // viewing hospitals falls under "devices" perm module (they share scope)
    const { session } = await requirePermission("devices", "view");
    const where = officeScope(session, new URL(req.url).searchParams.get("office"));
    const hospitals = await db.hospital.findMany({
      where,
      orderBy: { id: "desc" },
      include: { _count: { select: { devices: true } } },
    });
    return Response.json({ hospitals });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req);
    const parsed = hospitalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    const hospital = await db.hospital.create({
      data: { ...parsed.data, officeId },
    });
    return Response.json({ hospital }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
