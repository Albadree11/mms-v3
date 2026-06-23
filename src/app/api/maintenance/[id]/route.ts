// src/app/api/maintenance/[id]/route.ts — [FIX A3] edit/delete maintenance
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { maintenanceSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("maintenance", "edit");
    const { id } = await params;
    const recordId = Number(id);
    if (!recordId) throw new GuardError(400, "معرّف غير صالح");

    const body = await readJson(req);
    const parsed = maintenanceSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const scope = officeScope(session);
    const existing = await db.maintenanceRecord.findFirst({
      where: { id: recordId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "السجل غير موجود");

    // officeId is never changed from the body; deviceId is left as-is unless
    // explicitly re-pointed to a device within the caller's scope.
    const data: Record<string, unknown> = { ...parsed.data };
    delete (data as any).officeId;
    if (typeof parsed.data.deviceId === "number") {
      const device = await db.device.findFirst({
        where: { id: parsed.data.deviceId, ...scope },
        select: { id: true },
      });
      if (!device) throw new GuardError(404, "الجهاز غير موجود ضمن نطاقك");
    }

    const record = await db.maintenanceRecord.update({
      where: { id: recordId },
      data,
    });
    return Response.json({ record });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("maintenance", "full");
    const { id } = await params;
    const recordId = Number(id);
    if (!recordId) throw new GuardError(400, "معرّف غير صالح");

    const scope = officeScope(session);
    const existing = await db.maintenanceRecord.findFirst({
      where: { id: recordId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "السجل غير موجود");

    await db.maintenanceRecord.delete({ where: { id: recordId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
