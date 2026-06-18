// src/components/mms/views/ProjectsView.tsx
"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Plus, Loader2 } from "lucide-react";
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
import type { Project, Office } from "@/lib/types";
import { PROJECT_STATUS, PROJECT_TYPES, label } from "@/lib/enums";
import { useOffice } from "../OfficeContext";

const statusColor: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  active: "bg-teal-100 text-teal-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-300 text-slate-700",
  awarded: "bg-violet-100 text-violet-700",
};

function emptyForm() {
  return {
    title: "", description: "", startDate: "", endDate: "",
    contractor: "", contractNo: "", status: "draft", type: "tender",
    budget: "", officeId: "",
  };
}

export default function ProjectsView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [projects, setProjects] = useState<Project[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canEdit = user.isSuperAdmin || user.perms?.projects === "edit" || user.perms?.projects === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [pRes, oRes] = await Promise.all([
        fetch(`/api/projects${officeQ}`),
        fetch("/api/offices"),
      ]);
      const pData = await pRes.json();
      const oData = await oRes.json();
      if (pRes.ok) setProjects(pData.projects || []);
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
    setForm({ ...emptyForm(), officeId: presetOfficeId });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget: form.budget === "" ? null : Number(form.budget),
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      toast.success("تم حفظ المشروع");
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
        title="المشاريع والعقود"
        description="المناقصات والعقود والمشاريع المباشرة."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            مشروع جديد
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState title="لا توجد مشاريع" icon={FolderKanban} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>المقاول</TableHead>
                    <TableHead>الميزانية</TableHead>
                    <TableHead>المدة</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const office = offices.find((o) => o.id === p.officeId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.title}</div>
                          {p.contractNo && (
                            <div className="text-xs text-slate-500 font-mono">{p.contractNo}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{label("project_type", p.type)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColor[p.status]}>{label("project_status", p.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{p.contractor || "—"}</TableCell>
                        <TableCell className="text-sm">{p.budget ? p.budget.toLocaleString("ar-IQ") : "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {p.startDate || "—"} ← {p.endDate || "—"}
                        </TableCell>
                        {user.isSuperAdmin && (
                          <TableCell>
                            <OfficeBadge officeId={p.officeId} officeName={office?.name} color={office?.color} />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>مشروع جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>العنوان *</Label>
              <Input value={form.title} onChange={(e) => setField("title", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{label("project_type", t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>{label("project_status", s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ البدء</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الانتهاء</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المقاول</Label>
              <Input value={form.contractor} onChange={(e) => setField("contractor", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم العقد</Label>
              <Input value={form.contractNo} onChange={(e) => setField("contractNo", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الميزانية (دينار)</Label>
              <Input type="number" value={form.budget} onChange={(e) => setField("budget", e.target.value)} />
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
            <div className="space-y-2 md:col-span-2">
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={3} />
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
