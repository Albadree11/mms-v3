// src/components/mms/views/HospitalsView.tsx
"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Loader2, Phone, MapPin } from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Hospital, Office } from "@/lib/types";
import { HOSPITAL_TYPES, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

function emptyForm() {
  return {
    name: "",
    city: "",
    governorate: "",
    address: "",
    phone: "",
    contactPerson: "",
    type: "hospital",
    officeId: "",
  };
}

export default function HospitalsView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
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
      const [hRes, oRes] = await Promise.all([
        fetch(`/api/hospitals${officeQ}`),
        fetch("/api/offices"),
      ]);
      const hData = await hRes.json();
      const oData = await oRes.json();
      if (hRes.ok) setHospitals(hData.hospitals || []);
      if (oRes.ok) setOffices(oData.offices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function setField(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  function openCreate() {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تمت إضافة المؤسسة");
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
        title="المؤسسات الصحية"
        description="المستشفيات والمراكز الصحية التابعة للمكتب."
        action={
          canEdit && (
            <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة مؤسسة
            </Button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : hospitals.length === 0 ? (
        <Card><CardContent><EmptyState title="لا توجد مؤسسات" icon={Building2} /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hospitals.map((h) => {
            const office = offices.find((o) => o.id === h.officeId);
            return (
              <Card key={h.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-teal-600" />
                  </div>
                  <Badge variant="outline">{label("hospital_type", h.type)}</Badge>
                </div>
                <div className="font-bold text-slate-900 mb-1">{h.name}</div>
                <div className="space-y-1 text-xs text-slate-500">
                  {h.city && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {[h.governorate, h.city].filter(Boolean).join("، ")}
                    </div>
                  )}
                  {h.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      {h.phone}
                    </div>
                  )}
                  {h.contactPerson && (
                    <div>الجهة الاتصالية: {h.contactPerson}</div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <OfficeBadge officeId={h.officeId} officeName={office?.name} color={office?.color} />
                  <Badge variant="secondary">{h._count?.devices || 0} جهاز</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>إضافة مؤسسة صحية</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOSPITAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{label("hospital_type", t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المدينة</Label>
              <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المحافظة</Label>
              <Input value={form.governorate} onChange={(e) => setField("governorate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الجهة الاتصالية</Label>
              <Input value={form.contactPerson} onChange={(e) => setField("contactPerson", e.target.value)} />
            </div>
            {user.isSuperAdmin && (
              <div className="space-y-2">
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
