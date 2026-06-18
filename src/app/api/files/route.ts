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
    const uploadedBy = (formData.get("uploadedBy") as string) ?? "";
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
    const { data: { public