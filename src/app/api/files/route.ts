// src/app/api/files/route.ts — Supabase Storage + Firestore metadata
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db, Timestamp, serializeTimestamps } from "@/lib/firebase-admin";
import {
  requirePermission, getOfficeFilter, enforceOfficeOnWrite,
  handleError, GuardError,
} from "@/lib/guard";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const BUCKET = "mms-files";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("files", "view");
    const officeFilter = getOfficeFilter(session, new URL(req.url).searchParams.get("office"));

    let q: FirebaseFirestore.Query = db.collection("files");
    if (officeFilter) q = q.where("officeId", "==", officeFilter);
    q = q.orderBy("createdAt", "desc");
    const snap = await q.get();

    return Response.json({
      files: snap.docs.map((d) => serializeTimestamps({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("files", "edit");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // uploadedBy is always resolved from the verified session — never from client input
    const userSnap = await db.doc(`users/${session.userId}`).get();
    const uploadedBy: string = userSnap.exists
      ? ((userSnap.data()!.name as string) ?? session.userId)
      : session.userId;
    if (!file) throw new GuardError(400, "الملف مفقود");
    if (file.size > MAX_FILE_SIZE) throw new GuardError(413, "حجم الملف يتجاوز 50 ميجابايت");
    const officeId = enforceOfficeOnWrite(session, formData.get("officeId") as string);

    // مسار فريد في Supabase Storage
    const safeName = file.name.replace(/[^\w.؀-ۿ-]/g, "_");
    const storagePath = `${officeId}/${Date.now()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabase();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new GuardError(500, `فشل رفع الملف: ${uploadError.message}`);

    // رابط عام
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const ref = await db.collection("files").add({
      name:       file.name,
      type:       file.type || "application/octet-stream",
      size:       file.size,
      storageKey: storagePath,
      url:        publicUrl,
      uploadedBy,
      officeId,
      createdAt:  Timestamp.now(),
    });

    return Response.json(
      {
        file: serializeTimestamps({
          id: ref.id, name: file.name, type: file.type,
          size: file.size, storageKey: storagePath,
          url: publicUrl, uploadedBy, officeId,
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requirePermission("files", "edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new GuardError(400, "id مطلوب");

    const docRef = db.collection("files").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new GuardError(404, "الملف غير موجود");

    const data = snap.data()!;
    enforceOfficeOnWrite(session, data.officeId as string);

    // احذف من Supabase Storage
    if (data.storageKey) {
      const supabase = getSupabase();
      await supabase.storage
        .from(BUCKET)
        .remove([data.storageKey as string]);
    }

    await docRef.delete();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
