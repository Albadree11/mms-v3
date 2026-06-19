// src/app/api/hospitals/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { hospitalSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, readOfficeParam,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "view");
    const officeFilter = getOfficeFilter(session, readOfficeParam(req));

    let q: FirebaseFirestore.Query = db.collection("hospitals");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    // Count devices per hospital
    const hospitals = await Promise.all(
      snap.docs.map(async (doc) => {
        const devSnap = await db.collection("devices")
          .where("hospitalId", "==", doc.id).count().get();
        return serializeTimestamps({
          id: doc.id, ...doc.data(),
          _count: { devices: devSnap.data().count },
        });
      })
    );

    return Response.json({ hospitals });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("devices", "edit");
    const body = await readJson(req) as any;
    const parsed = hospitalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);

    const ref = await db.collection("hospitals").add({
      ...parsed.data,
      officeId,
      createdAt: Timestamp.now(),
    });

    return Response.json(
      { hospital: serializeTimestamps({ id: ref.id, ...parsed.data, officeId }) },
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
    if (!id) throw new Error("id مطلوب");

    const snap = await db.doc(`hospitals/${id}`).get();
    if (!snap.exists) return Response.json({ error: "غير موجود" }, { status: 404 });

    enforceOfficeOnWrite(session, snap.data()!.officeId as string);
    await db.doc(`hospitals/${id}`).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
