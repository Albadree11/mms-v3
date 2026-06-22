// src/lib/types.ts — shared frontend types

export interface Office {
  id: string;
  name: string;
  color: string;
  _count?: { devices: number; users: number; hospitals: number };
}

export interface User {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  phone?: string;
  department?: string | null;
  officeId: string | null;
  perms: Record<string, string>;
  isSuperAdmin?: boolean;
  createdAt?: string;
}

export interface Hospital {
  id: number;
  name: string;
  city?: string;
  governorate?: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
  type: string;
  officeId: string;
  _count?: { devices: number };
}

export interface WarrantyInfo {
  expiry: string | null;
  daysLeft: number | null;
  state: "under" | "expiring" | "expired" | "unknown";
}

export interface Device {
  id: number;
  name: string;
  model?: string;
  manufacturer: string; // [FIX 17] required identity field
  contractId?: string;
  projectName?: string;
  projectId?: number | null;
  project?: { id: number; title: string } | null;
  serial: string;
  image?: string | null;
  status: string;
  location: string; // legacy back-compat
  locationType?: string; // [EDIT] health_sector | hospital
  placeInFacility?: string; // [EDIT] أين داخل المؤسسة
  procureDate?: string; // [EDIT] تاريخ التجهيز
  warrantyMonths: number;
  installDate?: string;
  hospitalId: number | null;
  officeId: string;
  hospital?: { id: number; name: string } | null;
  warranty?: WarrantyInfo;
  // legacy optional fields kept for back-compat
  category?: string;
  supplier?: string;
  invoiceNo?: string;
  entryDate?: string;
  department?: string;
  nextMaintenance?: string;
  acquisitionType?: string;
  cost?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceRecord {
  id: number;
  deviceId: number;
  type: string;
  description: string;
  technician: string;
  parts: string;
  notes: string;
  date: string;
  cost: number;
  status: string;
  photoAfter?: string | null;
  photoReport?: string | null;
  officeId: string;
  device?: { id: number; name: string; serial: string } | null;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  contractor: string;
  contractNo: string;
  status: string;
  type: string;
  budget: number | null;
  officeId: string;
  awardedToDeviceId: number | null;
  awardedToDevice?: { id: number; name: string; serial: string } | null;
}

// [EDIT] Movement interface removed — Movements section deleted.


export interface Document {
  id: number;
  direction: string;
  docNumber: string;
  title: string;
  date: string;
  entity: string;
  notifiedEngineer: string;
  createdBy: string;
  image?: string | null;
  isMaintNotif: boolean;
  officeId: string;
  createdAt: string;
}

export interface Stocktake {
  id: number;
  date: string;
  by: string;
  summary: string;
  officeId: string;
  _count?: { items: number };
}

export interface FileEntry {
  id: number;
  name: string;
  type: string;
  uploadedBy: string;
  size: number;
  filePath: string;
  officeId: string;
  createdAt: string;
}
