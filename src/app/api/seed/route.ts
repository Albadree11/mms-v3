// src/app/api/seed/route.ts — one-click Firestore seed (dev / first-run only)
// Guards: blocked in production via NODE_ENV check.
import { db, Timestamp } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/password";
import { handleError } from "@/lib/guard";

// Super admin sees and edits everything across all offices.
const SUPER_ADMIN_PERMS = {
  devices:     "full",
  maintenance: "full",
  projects:    "full",
  files:       "full",
  documents:   "full",
  users:       "full",
};

// Office managers manage their own office's data.
const OFFICE_MANAGER_PERMS = {
  devices:     "full",
  maintenance: "full",
  projects:    "full",
  files:       "full",
  documents:   "full",
  users:       "view",
};

export async function POST() {
  // [FIX 4] Hard block in production — prevents accidental data wipe.
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "البذرة غير مسموح بها في بيئة الإنتاج" },
      { status: 403 }
    );
  }

  try {
    const now = Timestamp.now();

    // ── Offices (idempotent via set with merge) ──────────────────────────────
    const shateaRef = db.doc("offices/shatea");
    const diaarRef  = db.doc("offices/diaar");
    await Promise.all([
      shateaRef.set({ name: "مكتب الشاطئ", color: "cyan",    createdAt: now }, { merge: true }),
      diaarRef .set({ name: "مكتب الديار", color: "emerald", createdAt: now }, { merge: true }),
    ]);

    // ── Users ────────────────────────────────────────────────────────────────
    const pwHash = await hashPassword("1234");

    // Idempotent: check by email, only create if missing
    async function upsertUser(data: {
      name: string; email: string; officeId: string | null;
      department: string; perms: Record<string, string>;
    }) {
      const existing = await db.collection("users")
        .where("email", "==", data.email)
        .limit(1).get();
      if (!existing.empty) return existing.docs[0].id;
      const ref = await db.collection("users").add({
        ...data, password: pwHash, phone: null, createdAt: now,
      });
      return ref.id;
    }

    await Promise.all([
      upsertUser({
        name: "المدير العام", email: "admin@medical.iq",
        officeId: null, department: "الإدارة", perms: SUPER_ADMIN_PERMS,
      }),
      upsertUser({
        name: "مدير مكتب الشاطئ", email: "shatea.mgr@medical.iq",
        officeId: "shatea", department: "الإدارة", perms: OFFICE_MANAGER_PERMS,
      }),
      upsertUser({
        name: "مدير مكتب الديار", email: "diaar.mgr@medical.iq",
        officeId: "diaar", department: "الإدارة", perms: OFFICE_MANAGER_PERMS,
      }),
    ]);

    // ── Hospitals (skip if any exist) ────────────────────────────────────────
    const hospCount = await db.collection("hospitals").count().get();
    let shateaHospitalId: string | null = null;
    let diaarHospitalId:  string | null = null;

    if (hospCount.data().count === 0) {
      const [sh, di1] = await Promise.all([
        db.collection("hospitals").add({
          name: "مستشفى الشاطئ التعليمي", city: "بغداد",
          governorate: "بغداد", type: "hospital", officeId: "shatea", createdAt: now,
        }),
        db.collection("hospitals").add({
          name: "مركز الشاطئ الصحي", city: "بغداد",
          governorate: "بغداد", type: "health_center", officeId: "shatea", createdAt: now,
        }),
      ]);
      const di = await db.collection("hospitals").add({
        name: "مستشفى الديار العام", city: "بغداد",
        governorate: "بغداد", type: "hospital", officeId: "diaar", createdAt: now,
      });
      shateaHospitalId = sh.id;
      diaarHospitalId  = di.id;
    } else {
      // Fetch first hospital per office for device seeds
      const [sh, di] = await Promise.all([
        db.collection("hospitals").where("officeId", "==", "shatea").limit(1).get(),
        db.collection("hospitals").where("officeId", "==", "diaar").limit(1).get(),
      ]);
      shateaHospitalId = sh.docs[0]?.id ?? null;
      diaarHospitalId  = di.docs[0]?.id ?? null;
    }

    // ── Devices (skip if any exist) ──────────────────────────────────────────
    const devCount = await db.collection("devices").count().get();
    if (devCount.data().count === 0) {
      await Promise.all([
        db.collection("devices").add({
          name: "جهاز أشعة سينية", model: "XR-2000", manufacturer: "Siemens",
          category: "أشعة", serial: "SH-XR-001", cost: 25000000,
          warrantyMonths: 60, installDate: "2024-03-15",
          status: "active", location: "hospital",
          hospitalId: shateaHospitalId, officeId: "shatea",
          supplier: "شركة التقنيات الطبية", contractId: "C-2024-001",
          createdAt: now, updatedAt: now,
        }),
        db.collection("devices").add({
          name: "جهاز تخطيط قلب", model: "ECG-500", manufacturer: "GE Healthcare",
          category: "قلب", serial: "SH-ECG-001", cost: 3500000,
          warrantyMonths: 36, installDate: "2023-08-01",
          status: "active", location: "warehouse",
          hospitalId: null, officeId: "shatea",
          supplier: "مؤسسة المعدات الطبية", contractId: null,
          createdAt: now, updatedAt: now,
        }),
      ]);
    }

    return Response.json({ ok: true, message: "تم تهيئة البيانات الأولية بنجاح" });
  } catch (err: any) {
    console.error("Seed error:", err);
    return Response.json({ error: err.message ?? "خطأ في التهيئة" }, { status: 500 });
  }
}
