// src/app/api/devices/[id]/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { deviceSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  handleError,
  readJson,
  GuardError,
} from "@/lib/guard";
import { computeWarranty } from "@/lib/warranty";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("devices", "view");
    const { id } = await params;
    const deviceId = Number(id);
    if (!deviceId) throw new GuardError(400, "معرّف غير صالح");
    const scope = officeScope(session);
    const device = await db.device.findFirst({
      where: { id: deviceId, ...scope },
      include: {
        hospital: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        maintenance: { orderBy: { id: "desc" } },
      },
    });
    if (!device) throw new GuardError(404, "الجهاز غير موجود");
    return Response.json({
      device: {
        ...device,
        warranty: computeWarranty(device.procureDate || device.installDate, device.warrantyMonths),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const { id } = await params;
    const deviceId = Number(id);
    if (!deviceId) throw new GuardError(400, "معرّف غير صالح");
    const body = await readJson(req);
    const parsed = deviceSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    // Verify ownership within caller's office scope before any write.
    const scope = officeScope(session);
    const existing = await db.device.findFirst({
      where: { id: deviceId, ...scope },
      select: { id: true, officeId: true },
    });
    if (!existing) throw new GuardError(404, "الجهاز غير موجود");

    // deviceSchema intentionally excludes officeId ([FIX 7]); the only way to
    // set it on update is for a super admin to pass an explicit, verified value.
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (session.officeId === null && typeof body?.officeId === "string" && body.officeId) {
      const targetOffice = await db.office.findUnique({
        where: { id: body.officeId },
        select: { id: true },
      });
      if (!targetOffice) {
        throw new GuardError(400, "المكتب المطلوب غير موجود");
      }
      updateData.officeId = body.officeId;
    }
    // officeId is otherwise left untouched — normal users cannot move devices.

    const device = await db.device.update({
      where: { id: deviceId },
      data: updateData,
    });
    return Response.json({ device });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requirePermission("devices", "full");
    const { id } = await params;
    const deviceId = Number(id);
    if (!deviceId) throw new GuardError(400, "معرّف غير صالح");
    const scope = officeScope(session);
    const existing = await db.device.findFirst({
      where: { id: deviceId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "الجهاز غير موجود");
    // [FIX 2] MaintenanceRecord onDelete: Restrict blocks this automatically.
    await db.device.delete({ where: { id: deviceId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

