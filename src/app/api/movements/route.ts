// src/app/api/movements/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { movementSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, GuardError,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const deviceId = url.searchParams.get("deviceId");

    let q: FirebaseFirestore.Query = db.collection("movements");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (deviceId) q = q.where("deviceId", "==", deviceId);
    const snap = await q.get();

    const movements = (await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data();
        let device = null;
        if (d.deviceId) {
          const dev = await db.doc(`devices/${d.deviceId}`).get();
          if (dev.exists) {
            const dd = dev.data()!;
            device = { id: dev.id, name: dd.name, serial: dd.serial };
          }
        }
        return serializeTimestamps({ id: doc.id, ...d, device });
      })
    )).sort((a: any, b: any) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return Response.json({ movements });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req) as any;
    const parsed = movementSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    const devSnap = await db.doc(`devices/${parsed.data.deviceId}`).get();
    if (!devSnap.exists) throw new GuardError(404, "الجهاز غير موجود");
    const officeFilterCheck = getOfficeFilter(session);
    if (officeFilterCheck && devSnap.data()!.officeId !== officeFilterCheck) {
      throw new GuardError(404, "الجهاز غير موجود ضمن نطاقك");
    }
    const devData = devSnap.data()!;

    const movementData = {
      ...parsed.data,
      deviceNameSnap: parsed.data.deviceNameSnap || devData.name,
      serialSnap: parsed.data.serialSnap || devData.serial,
      officeId,
      createdAt: Timestamp.now(),
    };

    const locationUpdate: Record<string, string> =
      parsed.data.type === "install" ? { location: "hospital", status: "active" }
      : parsed.data.type === "return" ? { location: "warehouse" }
      : parsed.data.type === "receive" ? { location: "warehouse", status: "in_warehouse" } : {};

    if (Object.keys(locationUpdate).length > 0) {
      await db.doc(`devices/${parsed.data.deviceId}`).update({
        ...locationUpdate,
        updatedAt: Timestamp.now(),
      });
    }

    const ref = await db.collection("movements").add(movementData);
    return Response.json(
      { movement: serializeTimestamps({ id: ref.id, ...movementData }) },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`movements/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    await db.doc(`movements/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
