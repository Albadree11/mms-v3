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
export const HOSPITAL_TYPES = [
  "hospital",
  "clinic",
  "health_center",
  "medical_center",
] as const;
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
    clinic: "مركز صحي صغير",
    health_center: "مركز صحي",
    medical_center: "مركز طبي",
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
  model: z.string().default(""),
  manufacturer: z.string().default(""),
  category: z.string().default(""),
  supplier: z.string().default(""),
  contractId: z.string().default(""),
  projectName: z.string().default(""),
  invoiceNo: z.string().default(""),
  entryDate: z.string().default(""),
  department: z.string().default(""),
  nextMaintenance: z.string().default(""),
  serial: z.string().min(1, "الرقم التسلسلي مطلوب"),
  image: z.string().nullable().optional(),
  status: z.enum(DEVICE_STATUS).default("active"),
  location: z.enum(DEVICE_LOCATIONS).default("warehouse"), // [FIX 14]
  acquisitionType: z.enum(ACQUISITION_TYPES).default("contract"), // [FIX 9]
  cost: integerDinars.nullable().optional(),
  warrantyMonths: z.number().int().min(0).max(360).default(60),
  installDate: z.string().default(""),
  hospitalId: z.number().int().nullable().optional(),
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
  photoReport: z.string().nullable().optional(),
});

export const movementSchema = z.object({
  deviceId: z.number().int().positive(),
  type: z.enum(MOVEMENT_TYPES),
  deviceNameSnap: z.string().default(""), // [FIX 11]
  serialSnap: z.string().default(""), // [FIX 11]
  from: z.string().default(""),
  to: z.string().default(""),
  by: z.string().default(""),
  acquisitionType: z.string().default(""),
  note: z.string().default(""),
  date: z.string().min(1, "التاريخ مطلوب"),
});

export const stocktakeItemSchema = z.object({
  deviceId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  serial: z.string().default(""),
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
  city: z.string().default(""),
  governorate: z.string().default(""),
  address: z.string().default(""),
  phone: z.string().default(""),
  contactPerson: z.string().default(""),
  type: z.enum(HOSPITAL_TYPES).default("hospital"),
});

export const documentSchema = z.object({
  direction: z.enum(["صادر", "وارد"]).default("صادر"),
  title: z.string().min(1, "العنوان مطلوب"),
  date: z.string().default(""),
  entity: z.string().default(""),
  notifiedEngineer: z.string().default(""),
  createdBy: z.string().default(""),
  isMaintNotif: z.boolean().default(false),
  image: z.string().nullable().optional(),
});

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email("بريد غير صالح"),
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
