// src/app/api/documents/route.ts — atomic document numbering per office
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { documentSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson, GuardError,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("documents", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const direction = url.searchParams.get("direction");

    let q: FirebaseFirestore.Query = db.collection("documents");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (direction) q = q.where("direction", "==", direction);
    const snap = await q.get();

    return Response.json({
      documents: snap.docs
        .map((d) => serializeTimestamps({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("documents", "edit");
    const body = await readJson(req) as any;
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const officeId = enforceOfficeOnWrite(session, body?.officeId);
    const direction = parsed.data.direction;
    const prefix = direction === "صادر" ? "OUT" : "IN";
    const year = new Date().getFullYear();

    const counterKey = `${officeId}-${prefix}-${year}`;
    const counterRef = db.doc(`docCounters/${counterKey}`);
    const docRef = db.collection("documents").doc();

    const doc = await db.runTransaction(async (tx) => {
      const counter = await tx.get(counterRef);
      const nextSeq = (counter.exists ? (counter.data()!.seq as number) : 0) + 1;
      const docNumber = `${prefix}-${year}-${String(nextSeq).padStart(3, "0")}`;
      const now = Timestamp.now();

      tx.set(counterRef, { seq: nextSeq }, { merge: true });
      tx.set(docRef, {
        direction,
        docNumber,
        title: parsed.data.title,
        date: parsed.data.date || new Date().toISOString().slice(0, 10),
        entity: parsed.data.entity,
        notifiedEngineer: parsed.data.notifiedEngineer,
        createdBy: parsed.data.createdBy,
        isMaintNotif: parsed.data.isMaintNotif,
        image: parsed.data.image ?? null,
        officeId,
        createdAt: now,
      });

      return { id: docRef.id, docNumber, ...parsed.data, officeId };
    });

    return Response.json({ document: serializeTimestamps(doc) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
