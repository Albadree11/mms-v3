// src/components/mms/views/MovementsView.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, Loader2, ArrowDownToLine, PackageCheck, RotateCcw } from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
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
import type { Device, Movement, Office } from "@/lib/types";
import { MOVEMENT_TYPES, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

const typeIcon: Record<string, any> = {
  receive: ArrowDownToLine,
  install: PackageCheck,
  return: RotateCcw,
};
const typeColor: Record<string, string> = {
  receive: "bg-sky-100 text-sky-700",
  install: "bg-teal-100 text-teal-700",
  return: "bg-amber-100 text-amber-700",
};

function emptyForm() {
  return {
    deviceId: "",
    type: "install",
    from: "",
    to: "",
    by: "",
    acquisitionType: "",
    note: "",
    date: new Date().toISOString().slice(0, 10),
    officeId: "",
  };
}

export default function MovementsView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [movements, setMovements] = useState<Movement[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.devices === "edit" || user.perms?.devices === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [mRes, dRes, oRes] = await Promise.all([
        fetch(`/api/movements${officeQ}`),
        fetch(`/api/devices${officeQ}`),
        fetch("/api/offices"),
      ]);
      const mData = await mRes.json();
      const dData = await dRes.json();
      const oData = await oRes.json();
      if (mRes.ok) setMovements(mData.movements || []);
      if (dRes.ok) setDevices(dData.devices || []);
      if (oRes.ok) setOffices(oData.offices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function setField(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  function openCreate() {
    const presetOfficeId = !user.isSuperAdmin
      ? user.officeId || ""
      : activeOfficeId !== "all"
      ? activeOfficeId
      : "";
    setForm({
      ...emptyForm(),
      by: user.name,
      officeId: presetOfficeId,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, deviceId: Number(form.deviceId) };
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تم تسجيل الحركة");
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
        title="حركات الأجهزة"
        description="سجل دائم لاستلام وتركيب وإرجاع الأجهزة. اللقطات التاريخية محفوظة."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            تسجيل حركة
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : movements.length === 0 ? (
            <EmptyState title="لا توجد حركات" icon={ArrowLeftRight} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الجهاز (لقطة)</TableHead>
                    <TableHead>من → إلى</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>بواسطة</TableHead>
                    <TableHead>ملاحظة</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const Icon = typeIcon[m.type] || ArrowLeftRight;
                    const office = offices.find((o) => o.id === m.officeId);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge className={`${typeColor[m.type]} gap-1`}>
                            <Icon className="w-3 h-3" />
                            {label("movement_type", m.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{m.deviceNameSnap || m.device?.name || "—"}</div>
                          {m.serialSnap && (
                            <div className="text-xs text-slate-500 font-mono">{m.serialSnap}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.from || "—"} <span className="text-slate-400">←</span> {m.to || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{m.date}</TableCell>
                        <TableCell className="text-sm">{m.by || "—"}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{m.note}</TableCell>
                        {user.isSuperAdmin && (
                          <TableCell>
                            <OfficeBadge officeId={m.officeId} officeName={office?.name} color={office?.color} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>تسجيل حركة جهاز</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>الجهاز *</Label>
              <Select value={form.deviceId ? String(form.deviceId) : ""} onValueChange={(v) => setField("deviceId", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} — {d.serial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نوع الحركة</Label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{label("movement_type", t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>من</Label>
              <Input value={form.from} onChange={(e) => setField("from", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>إلى</Label>
              <Input value={form.to} onChange={(e) => setField("to", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>بواسطة</Label>
              <Input value={form.by} onChange={(e) => setField("by", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>نوع التملّك</Label>
              <Input value={form.acquisitionType} onChange={(e) => setField("acquisitionType", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظة</Label>
              <Textarea value={form.note} onChange={(e) => setField("note", e.target.value)} rows={2} />
            </div>
            {user.isSuperAdmin && (
              <div className="space-y-2 md:col-span-2">
                <Label>المكتب *</Label>
                <Select value={form.officeId} onValueChange={(v) => setField("officeId", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
