// src/lib/types.ts — shared frontend types
// NOTE: IDs are now strings (Firestore auto-generated document IDs).

export interface Office {
  id: string;
  name: string;
  color: string;
  _count?: { devices: number; users: number; hospitals: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string | null;
  officeId: string | null;
  perms: Record<string, string>;
  isSuperAdmin?: boolean;
  createdAt?: string;
}

export interface Hospital {
  id: string;
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
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  supplier?: string;
  contractId?: string;
  projectName?: string;
  invoiceNo?: string;
  entryDate?: string;
  department?: string;
  nextMaintenance?: string;
  serial: string;
  image?: string | null;
  status: string;
  location: string;
  acquisitionType: string;
  cost: number | null;
  warrantyMonths: number;
  installDate: string;
  hospitalId: string | null;
  officeId: string;
  hospital?: { id: string; name: string } | null;
  warranty?: WarrantyInfo;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceRecord {
  id: string;
  deviceId: string;
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
  device?: { id: string; name: string; serial: string } | null;
  createdAt?: string;
}

export interface Project {
  id: string;
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
  awardedToDeviceId: string | null;
  awardedToDevice?: { id: string; name: string; serial: string } | null;
  createdAt?: string;
}

export interface Movement {
  id: string;
  deviceId: string | null;
  type: string;
  deviceNameSnap: string;
  serialSnap: string;
  from: string;
  to: string;
  by: string;
  acquisitionType: string;
  note: string;
  date: string;
  officeId: string;
  device?: { id: string; name: string; serial: string } | null;
  createdAt?: string;
}

export interface Document {
  id: string;
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
  id: string;
  date: string;
  by: string;
  summary: Record<string, number>;
  officeId: string;
  createdAt?: string;
  _count?: { items: number };
}

export interface FileEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  storageKey: string;
  uploadedBy: string;
  officeId: string;
  createdAt?: string;
}

export interface StocktakeItem {
  deviceId: string | null;
  deviceNameSnap: string;
  serialSnap: string;
  result: "found" | "missing" | "damaged";
  note?: string;
}
