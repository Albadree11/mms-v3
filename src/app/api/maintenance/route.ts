// src/app/api/maintenance/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { maintenanceSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, GuardError,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const deviceId = url.searchParams.get("deviceId");

    let q: FirebaseFirestore.Query = db.collection("maintenance");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (deviceId) q = q.where("deviceId", "==", deviceId);
    const snap = await q.get();

    const records = (await Promise.all(
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

    return Response.json({ records });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "edit");
    const body = await readJson(req) as any;
    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    const devSnap = await db.doc(`devices/${parsed.data.deviceId}`).get();
    if (!devSnap.exists) throw new GuardError(404, "الجهاز غير موجود");
    if (devSnap.data()!.officeId !== officeId) throw new GuardError(403, "الجهاز لا ينتمي لهذا المكتب");

    const ref = await db.collection("maintenance").add({
      ...parsed.data,
      officeId,
      createdAt: Timestamp.now(),
    });

    return Response.json(
      { record: serializeTimestamps({ id: ref.id, ...parsed.data, officeId }) },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("maintenance", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id مطلوب" }, { status: 400 });

    const snap = await db.doc(`maintenance/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });
    enforceOfficeOnWrite(session, snap.data()!.officeId as string);

    await db.doc(`maintenance/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
