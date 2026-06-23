// src/app/api/hospitals/[id]/route.ts — [FIX A3] edit/delete hospitals
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hospitalSchema } from "@/lib/enums";
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
    const { session } = await requirePermission("devices", "edit");
    const { id } = await params;
    const hospitalId = Number(id);
    if (!hospitalId) throw new GuardError(400, "معرّف غير صالح");

    const body = await readJson(req);
    const parsed = hospitalSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const scope = officeScope(session);
    const existing = await db.hospital.findFirst({
      where: { id: hospitalId, ...scope },
      select: { id: true },
    });
    if (!existing) throw new GuardError(404, "المستشفى غير موجود");

    const data: Record<string, unknown> = { ...parsed.data };
    delete (data as any).officeId;

    const hospital = await db.hospital.update({
      where: { id: hospitalId },
      data,
    });
    return Response.json({ hospital });
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
    const hospitalId = Number(id);
    if (!hospitalId) throw new GuardError(400, "معرّف غير صالح");

    const scope = officeScope(session);
    const existing = await db.hospital.findFirst({
      where: { id: hospitalId, ...scope },
      select: { id: true, _count: { select: { devices: true } } },
    });
    if (!existing) throw new GuardError(404, "المستشفى غير موجود");

    // Devices reference hospitalId with onDelete: SetNull, so deletion would
    // silently orphan installed devices. Block it and tell the user instead.
    if (existing._count.devices > 0) {
      throw new GuardError(
        409,
        "لا يمكن حذف المستشفى لوجود أجهزة مرتبطة به. انقل الأجهزة أولاً."
      );
    }

    await db.hospital.delete({ where: { id: hospitalId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
