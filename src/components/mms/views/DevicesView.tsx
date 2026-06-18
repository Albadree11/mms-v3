// src/components/mms/views/DevicesView.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MonitorSmartphone,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Device, Hospital } from "@/lib/types";
import {
  DEVICE_STATUS,
  DEVICE_LOCATIONS,
  label,
} from "@/lib/enums";
import { WARRANTY_LABELS } from "@/lib/warranty";
import { useOffice } from "../OfficeContext";

const statusColor: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  maintenance: "bg-amber-100 text-amber-700",
  inactive: "bg-slate-200 text-slate-700",
  disposed: "bg-rose-100 text-rose-700",
  in_warehouse: "bg-cyan-100 text-cyan-700",
};

const warrantyColor: Record<string, string> = {
  under: "bg-emerald-100 text-emerald-700",
  expiring: "bg-amber-100 text-amber-700",
  expired: "bg-rose-100 text-rose-700",
  unknown: "bg-slate-100 text-slate-600",
};

function emptyForm(): any {
  return {
    name: "",
    model: "",
    manufacturer: "",
    category: "",
    supplier: "",
    contractId: "",
    projectName: "",
    invoiceNo: "",
    entryDate: "",
    department: "",
    nextMaintenance: "",
    serial: "",
    status: "active",
    location: "warehouse",
    acquisitionType: "contract",
    cost: "",
    warrantyMonths: 60,
    installDate: "",
    hospitalId: "",
    officeId: "",
  };
}

export default function DevicesView() {
  const office = useOffice();
  const { user, offices, activeOfficeId } = office;
  const [devices, setDevices] = useState<Device[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const canEdit = user.isSuperAdmin || user.perms?.devices === "edit" || user.perms?.devices === "full";
  const canDelete = user.isSuperAdmin || user.perms?.devices === "full";

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (locationFilter !== "all") params.set("location", locationFilter);
      // activeOfficeId is the global scope selected at login / via the switcher.
      if (activeOfficeId !== "all") params.set("office", activeOfficeId);
      const devQ = params.toString();
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [devRes, hosRes] = await Promise.all([
        fetch(`/api/devices${devQ ? `?${devQ}` : ""}`),
        fetch(`/api/hospitals${officeQ}`),
      ]);
      const devData = await devRes.json();
      const hosData = await hosRes.json();
      if (devRes.ok) setDevices(devData.devices || []);
      if (hosRes.ok) setHospitals(hosData.hospitals || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, locationFilter, activeOfficeId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.trim().toLowerCase();
    return devices.filter((d) =>
      [d.name, d.serial, d.model, d.manufacturer, d.category, d.supplier]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [devices, search]);

  function openCreate() {
    setEditing(null);
    // Super admin scoped to a specific office → pre-fill it. Super admin on
    // "all offices" → must pick one in the form. Normal users are locked to
    // their office by the server regardless of what's sent.
    const presetOfficeId = !user.isSuperAdmin
      ? user.officeId || ""
      : activeOfficeId !== "all"
      ? activeOfficeId
      : "";
    setForm({
      ...emptyForm(),
      officeId: presetOfficeId,
    });
    setDialogOpen(true);
  }

  function openEdit(d: Device) {
    setEditing(d);
    setForm({
      ...d,
      cost: d.cost ?? "",
      hospitalId: d.hospitalId ?? "",
      officeId: d.officeId,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      payload.cost = form.cost === "" ? null : Number(form.cost);
      payload.warrantyMonths = Number(form.warrantyMonths) || 60;
      payload.hospitalId = form.hospitalId === "" ? null : Number(form.hospitalId);
      if (editing) {
        delete payload.officeId; // normal users can't move office; super admin path handled in API
        const res = await fetch(`/api/devices/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل التحديث");
        toast.success("تم تحديث الجهاز");
      } else {
        const res = await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل الإنشاء");
        toast.success("تمت إضافة الجهاز");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("تأكيد حذف الجهاز؟ لا يمكن التراجع. سيُمنع الحذف إن وُجدت سجلات صيانة مرتبطة.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحذف");
      toast.success("تم حذف الجهاز");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function setField(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الأجهزة الطبية"
        description={
          user.isSuperAdmin
            ? "عرض جميع الأجهزة عبر كل المكاتب."
            : `عرض أجهزة مكتبك فقط — عزل خادمي مفعّل.`
        }
        action={
          canEdit && (
            <Button
              className="bg-gradient-to-l from-teal-500 to-emerald-600"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة جهاز
            </Button>
          )
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم، السيريال، الموديل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {DEVICE_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {label("device_status", s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الموقع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المواقع</SelectItem>
                {DEVICE_LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {label("device_location", l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="لا توجد أجهزة"
              description="ابدأ بإضافة جهاز طبي أو عدّل عوامل التصفية."
              icon={MonitorSmartphone}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجهاز</TableHead>
                    <TableHead>السيريال</TableHead>
                    <TableHead>الموقع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الضمان</TableHead>
                    <TableHead>التكلفة</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                    {canEdit && <TableHead className="text-left">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{d.name}</div>
                        <div className="text-xs text-slate-500">
                          {[d.manufacturer, d.model].filter(Boolean).join(" • ")}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.serial}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {label("device_location", d.location)}
                        </Badge>
                        {d.hospital && (
                          <div className="text-xs text-slate-500 mt-1">{d.hospital.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[d.status]}>
                          {label("device_status", d.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.warranty ? (
                          <Badge className={warrantyColor[d.warranty.state]}>
                            {WARRANTY_LABELS[d.warranty.state]}
                          </Badge>
                        ) : (
                          "—"
                        )}
                        {d.warranty?.daysLeft !== null && d.warranty?.daysLeft !== undefined && (
                          <div className="text-xs text-slate-500 mt-1">
                            {d.warranty.daysLeft} يوم
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.cost ? d.cost.toLocaleString("ar-IQ") : "—"}
                      </TableCell>
                      {user.isSuperAdmin && (
                        <TableCell>
                          <OfficeBadge
                            officeId={d.officeId}
                            officeName={offices.find((o) => o.id === d.officeId)?.name}
                            color={offices.find((o) => o.id === d.officeId)?.color}
                          />
                        </TableCell>
                      )}
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(d)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(d.id)}
                                disabled={deletingId === d.id}
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                              >
                                {deletingId === d.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل جهاز" : "إضافة جهاز جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>اسم الجهاز *</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>الرقم التسلسلي *</Label>
              <Input
                value={form.serial}
                onChange={(e) => setField("serial", e.target.value)}
                required
                placeholder="فريد ضمن المكتب [FIX 1]"
              />
            </div>
            <div className="space-y-2">
              <Label>الموديل</Label>
              <Input value={form.model} onChange={(e) => setField("model", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الشركة المصنّعة</Label>
              <Input
                value={form.manufacturer}
                onChange={(e) => setField("manufacturer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>المورّد</Label>
              <Input
                value={form.supplier}
                onChange={(e) => setField("supplier", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>رقم العقد</Label>
              <Input
                value={form.contractId}
                onChange={(e) => setField("contractId", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {label("device_status", s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Select value={form.location} onValueChange={(v) => setField("location", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {label("device_location", l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستشفى</Label>
              <Select
                value={form.hospitalId ? String(form.hospitalId) : "none"}
                onValueChange={(v) => setField("hospitalId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— لا يوجد —</SelectItem>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مدة الضمان (شهر)</Label>
              <Input
                type="number"
                value={form.warrantyMonths}
                onChange={(e) => setField("warrantyMonths", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ التركيب</Label>
              <Input
                type="date"
                value={form.installDate}
                onChange={(e) => setField("installDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Input
                value={form.department}
                onChange={(e) => setField("department", e.target.value)}
              />
            </div>
            {user.isSuperAdmin && (
              <div className="space-y-2">
                <Label>المكتب (مدير عام) *</Label>
                <Select
                  value={form.officeId}
                  onValueChange={(v) => setField("officeId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المكتب" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="md:col-span-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-l from-teal-500 to-emerald-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الحفظ
                  </>
                ) : editing ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة الجهاز"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
