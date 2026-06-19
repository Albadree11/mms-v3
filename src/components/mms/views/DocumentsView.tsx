// src/components/mms/views/DocumentsView.tsx
"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type { Document, Office } from "@/lib/types";
import { useOffice } from "../OfficeContext";

function emptyForm() {
  return {
    direction: "صادر",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    entity: "",
    notifiedEngineer: "",
    createdBy: "",
    isMaintNotif: false,
    officeId: "",
  };
}

export default function DocumentsView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [docs, setDocs] = useState<Document[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.documents === "edit" || user.perms?.documents === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [dRes, oRes] = await Promise.all([
        fetch(`/api/documents${officeQ}`),
        fetch("/api/offices"),
      ]);
      const dData = await dRes.json();
      const oData = await oRes.json();
      if (dRes.ok) setDocs(dData.documents || []);
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
      officeId: presetOfficeId,
      createdBy: user.name,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success(`تم إنشاء الكتاب برقم: ${data.document.docNumber}`);
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
        title="الكتب الرسمية"
        description="الصادر والوارد — ترقيم ذرّي آمن."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            كتاب جديد
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : docs.length === 0 ? (
            <EmptyState title="لا توجد كتب" icon={FileText} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الكتاب</TableHead>
                    <TableHead>الاتجاه</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الجهة</TableHead>
                    <TableHead>المهندس المبلّغ</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => {
                    const office = offices.find((o) => o.id === d.officeId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs font-semibold">{d.docNumber}</TableCell>
                        <TableCell>
                          {d.direction === "صادر" ? (
                            <Badge className="bg-teal-100 text-teal-700 gap-1">
                              <ArrowUpRight className="w-3 h-3" /> صادر
                            </Badge>
                          ) : (
                            <Badge className="bg-sky-100 text-sky-700 gap-1">
                              <ArrowDownRight className="w-3 h-3" /> وارد
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                          {d.isMaintNotif && (
                            <Badge variant="outline" className="mt-1 text-xs">إشعار صيانة</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{d.date}</TableCell>
                        <TableCell className="text-sm">{d.entity || "—"}</TableCell>
                        <TableCell className="text-sm">{d.notifiedEngineer || "—"}</TableCell>
                        {user.isSuperAdmin && (
                          <TableCell>
                            <OfficeBadge officeId={d.officeId} officeName={office?.name} color={office?.color} />
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
          <DialogHeader><DialogTitle>كتاب رسمي جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>الاتجاه</Label>
              <Select value={form.direction} onValueChange={(v) => setField("direction", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="صادر">صادر</SelectItem>
                  <SelectItem value="وارد">وارد</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-slate-500">
                رقم الكتاب يُولّد تلقائياً (OUT/IN-YYYY-NNN) داخل transaction مع قيد تفرد.
              </div>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>العنوان *</Label>
              <Input value={form.title} onChange={(e) => setField("title", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الجهة</Label>
              <Input value={form.entity} onChange={(e) => setField("entity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المهندس المبلّغ</Label>
              <Input value={form.notifiedEngineer} onChange={(e) => setField("notifiedEngineer", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2 flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <Switch
                checked={form.isMaintNotif}
                onCheckedChange={(v) => setField("isMaintNotif", v)}
              />
              <Label className="cursor-pointer">إشعار صيانة</Label>
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
