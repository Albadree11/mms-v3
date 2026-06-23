// src/app/api/maintenance/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { maintenanceSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "view");
    const url = new URL(req.url);
    const deviceId = url.searchParams.get("deviceId");
    const where: any = officeScope(session, url.searchParams.get("office"));
    if (deviceId) where.deviceId = Number(deviceId);
    const records = await db.maintenanceRecord.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        device: { select: { id: true, name: true, serial: true } },
      },
    });
    return Response.json({ records });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "edit");
    const body = await readJson(req);
    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    // verify device belongs to caller's office (or super admin)
    const scope = officeScope(session);
    const device = await db.device.findFirst({
      where: { id: parsed.data.deviceId, ...scope },
      select: { id: true },
    });
    if (!device) throw new GuardError(404, "الجهاز غير موجود ضمن نطاقك");
    const record = await db.maintenanceRecord.create({
      data: { ...parsed.data, officeId },
    });
    return Response.json({ record }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
