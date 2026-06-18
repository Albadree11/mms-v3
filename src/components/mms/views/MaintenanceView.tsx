// src/components/mms/views/MaintenanceView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Wrench, Plus, Loader2 } from "lucide-react";
import { PageHeader, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Device, MaintenanceRecord } from "@/lib/types";
import { MAINT_TYPES, MAINT_STATUS, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

const statusColor: Record<string, string> = {
  scheduled: "bg-slate-200 text-slate-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const typeColor: Record<string, string> = {
  preventive: "bg-teal-100 text-teal-700",
  corrective: "bg-amber-100 text-amber-700",
  emergency: "bg-rose-100 text-rose-700",
};

function emptyForm() {
  return {
    serialQuery: "", // free-text search; resolved to deviceId on submit
    deviceId: "",
    type: "preventive",
    description: "",
    technician: "",
    parts: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
    cost: "",
    status: "scheduled",
  };
}

export default function MaintenanceView() {
  const office = useOffice();
  const { user, activeOfficeId } = office;
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.maintenance === "edit" || user.perms?.maintenance === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [recRes, devRes] = await Promise.all([
        fetch(`/api/maintenance${officeQ}`),
        fetch(`/api/devices${officeQ}`),
      ]);
      const recData = await recRes.json();
      const devData = await devRes.json();
      if (recRes.ok) setRecords(recData.records || []);
      if (devRes.ok) setDevices(devData.devices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function setField(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  // Devices whose serial matches the typed query (case-insensitive, partial).
  // Shows up to 7 suggestions so the technician can pick the right one.
  const serialMatches = useMemo(() => {
    const q = (form.serialQuery || "").trim().toLowerCase();
    if (!q) return [];
    return devices
      .filter((d) => d.serial.toLowerCase().includes(q))
      .slice(0, 7);
  }, [devices, form.serialQuery]);

  function pickDevice(d: Device) {
    setForm((f: any) => ({
      ...f,
      serialQuery: d.serial,
      deviceId: String(d.id),
    }));
  }

  function openCreate() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Resolve the typed serial to a deviceId one more time so a partial
    // match that the user didn't click still works if there's exactly one hit.
    let deviceId = Number(form.deviceId);
    if (!deviceId) {
      const exact = devices.find(
        (d) => d.serial.toLowerCase() === (form.serialQuery || "").trim().toLowerCase()
      );
      if (exact) deviceId = exact.id;
    }
    if (!deviceId) {
      toast.error("لم يُعثر على جهاز بهذا الرقم التسلسلي");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        deviceId,
        cost: form.cost === "" ? 0 : Number(form.cost),
      };
      delete payload.serialQuery;
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تم حفظ سجل الصيانة");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="سجلات الصيانة"
        description="الصيانة الوقائية والتصحيحية والطارئة."
        action={
          canEdit && (
            <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة سجل
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : records.length === 0 ? (
            <EmptyState title="لا توجد سجلات" icon={Wrench} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجهاز</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الفني</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الوصف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.device?.name || "—"}</div>
                        <div className="text-xs text-slate-500 font-mono">{r.device?.serial}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeColor[r.type]}>{label("maint_type", r.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.date}</TableCell>
                      <TableCell className="text-sm">{r.technician || "—"}</TableCell>
                      <TableCell className="text-sm">{r.cost ? r.cost.toLocaleString("ar-IQ") : "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColor[r.status]}>{label("maint_status", r.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة سجل صيانة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>الرقم التسلسلي للجهاز *</Label>
              <Input
                value={form.serialQuery}
                onChange={(e) => setField("serialQuery", e.target.value)}
                placeholder="اكتب الرقم التسلسلي للبحث..."
                required
                autoComplete="off"
              />
              {/* Live suggestions — pick one to lock deviceId. */}
              {form.serialQuery && !form.deviceId && serialMatches.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white">
                  {serialMatches.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => pickDevice(d)}
                      className="w-full text-right p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{d.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{d.serial}</div>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {d.manufacturer || "—"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {/* Confirmation chip once a device is locked. */}
              {form.deviceId && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-teal-50 border border-teal-100">
                  <Badge className="bg-teal-100 text-teal-700">محدّد</Badge>
                  <span className="text-sm font-medium">
                    {devices.find((d) => String(d.id) === form.deviceId)?.name || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setField("deviceId", "")}
                    className="text-xs text-slate-500 hover:text-rose-600 mr-auto"
                  >
                    تغيير
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{label("maint_type", t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>{label("maint_status", s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الفني</Label>
              <Input value={form.technician} onChange={(e) => setField("technician", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>القطع المُستبدلة</Label>
              <Input value={form.parts} onChange={(e) => setField("parts", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>التكلفة (دينار)</Label>
              <Input type="number" value={form.cost} onChange={(e) => setField("cost", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} />
            </div>
            <DialogFooter className="md:col-span-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-gradient-to-l from-teal-500 to-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
