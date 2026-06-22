// src/lib/enums.ts — [FIX 8, 9, 10, 14]
// Single source of truth for all enum-like values and zod validation schemas.

import { z } from "zod";

// ============================================================
// Unified value lists (as const) — import everywhere, never hardcode strings.
// ============================================================
export const DEVICE_LOCATIONS = ["warehouse", "hospital"] as const; // [FIX 14]
export const DEVICE_STATUS = [
  "active",
  "maintenance",
  "inactive",
  "disposed",
  "in_warehouse",
] as const;
export const ACQUISITION_TYPES = ["contract", "direct", "donation", "lease"] as const; // [FIX 9]
export const STOCKTAKE_RESULTS = ["found", "missing", "damaged"] as const; // [FIX 8]
export const MOVEMENT_TYPES = ["receive", "install", "return"] as const;
export const MAINT_TYPES = ["preventive", "corrective", "emergency"] as const;
export const MAINT_STATUS = ["scheduled", "in_progress", "completed"] as const;
export const HOSPITAL_TYPES = ["hospital", "health_center"] as const;
export const PROJECT_STATUS = [
  "draft",
  "pending",
  "active",
  "completed",
  "closed",
  "awarded",
] as const;
export const PROJECT_TYPES = ["tender", "contract", "direct"] as const;

// Permission levels & modules
export const PERM_LEVELS = ["none", "view", "edit", "full"] as const;
export const PERM_MODULES = [
  "devices",
  "maintenance",
  "projects",
  "files",
  "documents",
  "users",
] as const;

export type PermLevel = (typeof PERM_LEVELS)[number];
export type PermModule = (typeof PERM_MODULES)[number];

// ============================================================
// Arabic display labels for each enum
// ============================================================
export const LABELS: Record<string, Record<string, string>> = {
  device_location: {
    warehouse: "المخزن",
    hospital: "المستشفى",
  },
  location_type: {
    health_sector: "قطاع صحي",
    hospital: "مستشفى",
  },
  device_status: {
    active: "فعّال",
    maintenance: "تحت الصيانة",
    inactive: "غير فعّال",
    disposed: "مُستبعد",
    in_warehouse: "في المخزن",
  },
  acquisition: {
    contract: "عقد",
    direct: "شراء مباشر",
    donation: "تبرّع",
    lease: "إيجار",
  },
  stocktake_result: {
    found: "موجود",
    missing: "مفقود",
    damaged: "تالف",
  },
  movement_type: {
    receive: "استلام",
    install: "تركيب",
    return: "إرجاع",
  },
  maint_type: {
    preventive: "وقائية",
    corrective: "تصحيحية",
    emergency: "طوارئ",
  },
  maint_status: {
    scheduled: "مجدولة",
    in_progress: "قيد التنفيذ",
    completed: "مكتملة",
  },
  hospital_type: {
    hospital: "مستشفى",
    health_center: "مركز صحي",
  },
  project_status: {
    draft: "مسودة",
    pending: "قيد الانتظار",
    active: "نشط",
    completed: "مكتمل",
    closed: "مغلق",
    awarded: "إحالة",
  },
  project_type: {
    tender: "مناقصة",
    contract: "عقد",
    direct: "مباشر",
  },
  perm_level: {
    none: "لا صلاحية",
    view: "عرض",
    edit: "تعديل",
    full: "كامل",
  },
};

export function label(group: string, value: string): string {
  return LABELS[group]?.[value] ?? value;
}

// ============================================================
// Zod schemas for server-side validation
// ============================================================
const integerDinars = z
  .number()
  .int("يجب أن يكون المبلغ عدداً صحيحاً (دينار)")
  .nonnegative("لا يمكن أن يكون المبلغ سالباً"); // [FIX 10]

export const deviceSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  // [EDIT] model is now required
  model: z.string().min(1, "الموديل مطلوب"),
  // [FIX 17] manufacturer is part of the device identity (serial + manufacturer).
  manufacturer: z.string().min(1, "الشركة المصنّعة مطلوبة"),
  // [EDIT] contract number now required
  contractId: z.string().min(1, "رقم العقد مطلوب"),
  // [EDIT] اسم المشروع — dropdown linked to a Project (optional)
  projectId: z.number().int().nullable().optional(),
  // [EDIT] new placement model
  locationType: z.enum(["health_sector", "hospital"]).default("hospital"),
  placeInFacility: z.string().default(""),
  // [EDIT] الجهاز يرتبط بالمؤسسة عبر hospitalId (قائمة المؤسسات الحقيقية)
  hospitalId: z.number().int().nullable().optional(),
  // [EDIT] تاريخ التجهيز + مدة الضمان (مطلوبة)
  procureDate: z.string().default(""),
  warrantyMonths: z.number().int().min(0).max(360),
  // --- legacy fields kept optional for back-compat (removed from the form) ---
  category: z.string().default(""),
  supplier: z.string().default(""),
  invoiceNo: z.string().default(""),
  entryDate: z.string().default(""),
  department: z.string().default(""),
  nextMaintenance: z.string().default(""),
  acquisitionType: z.enum(ACQUISITION_TYPES).default("contract"),
  cost: integerDinars.nullable().optional(),
  location: z.enum(DEVICE_LOCATIONS).default("warehouse"),
  installDate: z.string().default(""),
  serial: z.string().min(1, "الرقم التسلسلي مطلوب"),
  image: z.string().nullable().optional(),
  status: z.enum(DEVICE_STATUS).default("active"),
  // NOTE: officeId is intentionally NOT taken from body — enforced from session [FIX 7]
});

export type DeviceInput = z.infer<typeof deviceSchema>;

export const maintenanceSchema = z.object({
  deviceId: z.number().int().positive(),
  type: z.enum(MAINT_TYPES),
  description: z.string().default(""),
  technician: z.string().default(""),
  parts: z.string().default(""),
  notes: z.string().default(""),
  date: z.string().min(1, "التاريخ مطلوب"),
  cost: integerDinars.default(0),
  status: z.enum(MAINT_STATUS).default("scheduled"),
  photoAfter: z.string().nullable().optional(),
  // [EDIT] صورة انجاز العمل — required
  photoReport: z.string().min(1, "صورة إنجاز العمل مطلوبة"),
});

// [EDIT] movementSchema removed — Movements section deleted at user request.

export const stocktakeItemSchema = z.object({
  deviceId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  serial: z.string().default(""),
  manufacturer: z.string().default(""), // [FIX 17]
  result: z.enum(STOCKTAKE_RESULTS).default("found"), // [FIX 8]
  note: z.string().default(""),
});

export const stocktakeSchema = z.object({
  date: z.string().min(1),
  by: z.string().default(""),
  items: z.array(stocktakeItemSchema).default([]),
});

export const projectSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  contractor: z.string().default(""),
  contractNo: z.string().default(""),
  status: z.enum(PROJECT_STATUS).default("draft"),
  type: z.enum(PROJECT_TYPES).default("tender"),
  budget: integerDinars.nullable().optional(),
  awardedToDeviceId: z.number().int().nullable().optional(),
});

export const hospitalSchema = z.object({
  name: z.string().min(1),
  // [EDIT] removed from form: city, phone, contactPerson (kept optional for data)
  city: z.string().default(""),
  governorate: z.string().default(""),
  address: z.string().default(""),
  phone: z.string().default(""),
  contactPerson: z.string().default(""),
  // [EDIT] type reduced to hospital | health_center, required
  type: z.enum(["hospital", "health_center"]),
});

export const documentSchema = z.object({
  direction: z.enum(["صادر", "وارد"]).default("صادر"),
  title: z.string().min(1, "العنوان مطلوب"),
  date: z.string().default(""),
  entity: z.string().default(""),
  // [EDIT] notifiedEngineer removed from form (kept optional for data)
  notifiedEngineer: z.string().default(""),
  createdBy: z.string().default(""),
  isMaintNotif: z.boolean().default(false),
  // [EDIT] attachment image now required
  image: z.string().min(1, "صورة الكتاب / المرفق مطلوبة"),
});

export const userSchema = z.object({
  name: z.string().min(1),
  // [EDIT] login by username instead of email
  username: z.string().min(3, "اسم المستخدم قصير جداً (3 أحرف على الأقل)"),
  email: z.string().email("بريد غير صالح").optional().or(z.literal("")),
  password: z.string().min(4, "كلمة المرور قصيرة جداً").optional(),
  phone: z.string().default(""),
  department: z.string().default(""),
  officeId: z.string().nullable().optional(),
  perms: z.record(z.string(), z.enum(PERM_LEVELS)).default({}),
});

export const officeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default("blue"),
});
