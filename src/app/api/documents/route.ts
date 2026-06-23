// src/app/api/documents/route.ts — [FIX 16] atomic document numbering
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { documentSchema } from "@/lib/enums";
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
    const { session } = await requirePermission("documents", "view");
    const url = new URL(req.url);
    const where: any = officeScope(session, url.searchParams.get("office"));
    const direction = url.searchParams.get("direction");
    if (direction) where.direction = direction;
    const documents = await db.document.findMany({
      where,
      orderBy: { id: "desc" },
    });
    return Response.json({ documents });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("documents", "edit");
    const body = await readJson(req);
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

    // [FIX 16][FIX A1][FIX A2] atomic numbering inside a transaction with retry.
    // - A2: numbering is scoped per office, so each office has its own clean
    //   sequence (OUT-2026-001, 002, ... independently of other offices).
    // - A1: the previous code sorted docNumber as a STRING, which breaks after
    //   999 (e.g. "...-1000" sorts below "...-999"). We now fetch all matching
    //   docNumbers and compute the max sequence NUMERICALLY, and pad to 5 digits.
    const MAX_RETRIES = 5;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const doc = await db.$transaction(async (tx) => {
          const existing = await tx.document.findMany({
            where: {
              officeId, // [FIX A2] per-office sequence
              docNumber: { startsWith: `${prefix}-${year}-` },
            },
            select: { docNumber: true },
          });
          // [FIX A1] numeric max, not string ordering
          let maxSeq = 0;
          for (const d of existing) {
            const seq = parseInt(d.docNumber.split("-").pop() ?? "", 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
          const nextSeq = maxSeq + 1;
          const docNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
          return tx.document.create({
            data: {
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
            },
          });
        });
        return Response.json({ document: doc }, { status: 201 });
      } catch (e: any) {
        lastErr = e;
        // unique constraint violation → another request grabbed the number; retry
        const msg = (e?.message || "").toLowerCase();
        if (!msg.includes("unique constraint")) break;
      }
    }
    throw lastErr ?? new GuardError(500, "فشل توليد رقم الكتاب");
  } catch (err) {
    return handleError(err);
  }
}
