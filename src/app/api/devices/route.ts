// src/app/api/devices/route.ts — reference implementation applying all fixes
// [FIX 1, 3, 6, 7, 9, 10, 12, 14]
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { deviceSchema } from "@/lib/enums";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  readJson,
  readOfficeParam,
  GuardError,
} from "@/lib/guard";
import { computeWarranty } from "@/lib/warranty";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const where: Record<string, unknown> = {
      ...officeScope(session, readOfficeParam(req)),
    };
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const location = url.searchParams.get("location");
    if (status) where.status = status;
    if (location) where.location = location;

    // [FIX 12] explicit select keeps the heavy image column out of list views.
    // [FIX 3]  warranty is computed on the fly, never stored.
    const devices = await db.device.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        model: true,
        manufacturer: true,
        category: true,
        supplier: true,
        contractId: true,
        projectName: true,
        invoiceNo: true,
        entryDate: true,
        department: true,
        nextMaintenance: true,
        serial: true,
        status: true,
        location: true,
        locationType: true,
        placeInFacility: true,
        acquisitionType: true,
        cost: true,
        warrantyMonths: true,
        installDate: true,
        procureDate: true,
        projectId: true,
        project: { select: { id: true, title: true } },
        hospitalId: true,
        hospital: { select: { id: true, name: true } },
        officeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const withWarranty = devices.map((d) => ({
      ...d,
      warranty: computeWarranty(d.procureDate || d.installDate, d.warrantyMonths),
    }));
    return Response.json({ devices: withWarranty });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req);
    const parsed = deviceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    // officeId comes from the session, never the body ([FIX 7]). The DB
    // unique constraint on [serial, officeId] turns duplicates into 409 ([FIX 1]).
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    // [EDIT] if linked to a project or facility, it must belong to this office
    if (parsed.data.projectId != null) {
      const proj = await db.project.findFirst({
        where: { id: parsed.data.projectId, officeId },
        select: { id: true },
      });
      if (!proj) throw new GuardError(404, "المشروع غير موجود ضمن نطاقك");
    }
    if (parsed.data.hospitalId != null) {
      const hosp = await db.hospital.findFirst({
        where: { id: parsed.data.hospitalId, officeId },
        select: { id: true },
      });
      if (!hosp) throw new GuardError(404, "المؤسسة غير موجودة ضمن نطاقك");
    }
    const device = await db.device.create({
      data: { ...parsed.data, officeId },
    });
    return Response.json({ device }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
