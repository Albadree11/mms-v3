// src/app/api/projects/route.ts
import { NextRequest } from "next/server";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import { projectSchema } from "@/lib/enums";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, readJson,
} from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("projects", "view");
    const url = new URL(req.url);
    const officeFilter = getOfficeFilter(session, url.searchParams.get("office"));
    const status = url.searchParams.get("status");

    let q: FirebaseFirestore.Query = db.collection("projects");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    if (status)       q = q.where("status",   "==", status);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    // Attach awardedToDevice info where applicable
    const projects = await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data();
        let awardedToDevice = null;
        if (d.awardedToDeviceId) {
          const dev = await db.doc(`devices/${d.awardedToDeviceId}`).get();
          if (dev.exists) {
            const dd = dev.data()!;
            awardedToDevice = { id: dev.id, name: dd.name, serial: dd.serial };
          }
        }
        return serializeTimestamps({ id: doc.id, ...d, awardedToDevice });
      })
    );

    return Response.json({ projects });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: 