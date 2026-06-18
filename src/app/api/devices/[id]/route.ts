// src/app/api/devices/[id]/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { deviceSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, handleError,
  readJson, GuardError,
} from "@/lib/guard";
import { computeWarranty } from "@/lib/warranty";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePermission("devices", "view");
    const { id } = await params;
    if (!id) throw new GuardError(400, "معرّف غير صالح");

    const snap = await db.doc(`devices/${id}`).get();
    if (!snap.exists) throw new GuardError(404, "الجهاز غير موجود");

    const officeFilter = getOfficeFilter(session);
    const d = snap.data()!;
    if (officeFilter && d.officeId !== officeFilter) throw new GuardError(404, "الجهاز غير موجود");

    // Fetch related data in parallel
    const [maintSnap, movSnap] = await Promise.all([
      db.collection("maintenance").where("deviceId", "==", id).orderBy("createdAt", "desc").get(),
      db.collection("movements").where("deviceId",  "==", id).orderBy("createdAt", "desc").get(),
    ]);

    let hospital = null;
    if (d.hospitalId) {
      const h = await db.doc(`hospitals/${d.hospitalId}`).get();
      if (h.exists) hospital = { id: h.id, name: h.data()!.name };
    }

    return Response.json({
      device: serializeTimestamps({
        id: snap.id, ...d,
        hospital,
        maintenance: maintSnap.docs.map(m => ({ id: m.id, ...m.data() })),
        movements:   movSnap.docs.map(m  => ({ id: m.id, ...m.data() })),
        warranty:    computeWarranty(d.installDate ?? "", d.warrantyMonths ?? 0),
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const { id } = await params;
    if (!id) throw new GuardError(400, "معرّف غير صالح");

    const body = await readJson(req) as any;
    const parsed = deviceSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const snap = await db.doc(`devices/${id}`).get();
    if (!snap.exists) throw new GuardError(404, "الجهاز غير موجود");

    const officeFilter = getOfficeFilter(session);
    if (officeFilter && snap.data()!.officeId !== officeFilter) {
      throw new GuardError(404, "الجهاز غير موجود");
    }

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: Timestamp.now() };

    // Super admin can move device to another office
    if (session.officeId === null && typeof body?.officeId === "string" && body.officeId) {
      const officeSnap = await db.doc(`offices/${body.officeId}`).get();
      if (!officeSnap.exists) throw new GuardError(400, "المكتب المطلوب غير موجود");
      updateData.officeId = body.officeId;
    }

    await db.doc(`devices/${id}`).update(updateData);
    const updated = serializeTimestamps({ id, ...snap.data(), ...updateData });
    return Response.json({ device: updated });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePermission("devices", "full");
    const { id } = await params;
    if (!id) throw new GuardError(400, "معرّف غير صالح");

    const snap = await db.doc(`devices/${id}`).get();
    if (!snap.exists) throw new GuardError(404, "الجهاز غير موجود");

    const officeFilter = getOfficeFil