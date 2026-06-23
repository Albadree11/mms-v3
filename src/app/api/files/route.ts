// src/app/api/files/route.ts
// [SECURITY] uploadedBy always from server session — never from client input.
// [VERCEL]   Files stored in Supabase Storage (not local disk — Vercel is stateless).
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import {
  requirePermission,
  officeScope,
  enforceOfficeOnWrite,
  handleError,
  GuardError,
} from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "mms-files";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePermission("files", "view");
    const where = officeScope(session, new URL(req.url).searchParams.get("office"));
    const files = await db.fileEntry.findMany({
      where,
      orderBy: { id: "desc" },
    });
    return Response.json({ files });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requirePermission("files", "edit");
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new GuardError(400, "الملف مفقود");
    if (file.size > MAX_FILE_SIZE) {
      throw new GuardError(413, "حجم الملف يتجاوز الحد الأقصى (50 ميجابايت)");
    }
    const officeId = enforceOfficeOnWrite(session, formData.get("officeId") as string);

    // [SECURITY] uploadedBy from server session only.
    const uploader = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });
    const uploadedBy = uploader?.name ?? "";

    // Upload to Supabase Storage.
    const supabase = getSupabase();
    const ext = file.name.split(".").pop() ?? "";
    const safeName = `${officeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(safeName, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw new GuardError(500, "فشل رفع الملف إلى التخزين");

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(safeName);

    const fileEntry = await db.fileEntry.create({
      data: {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        filePath: urlData.publicUrl,
        uploadedBy,
        officeId,
      },
    });
    return Response.json({ file: fileEntry }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
