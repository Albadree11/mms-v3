// src/components/mms/views/FilesView.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Paperclip, Plus, Loader2, FileText, FileImage, File } from "lucide-react";
import { PageHeader, EmptyState, OfficeBadge } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { FileEntry, Office } from "@/lib/types";
import { useOffice } from "../OfficeContext";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf") || type.includes("text") || type.includes("document")) return FileText;
  return File;
}

export default function FilesView() {
  const officeCtx = useOffice();
  const { user, activeOfficeId } = officeCtx;
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");
  const [officeId, setOfficeId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = user.isSuperAdmin || user.perms?.files === "edit" || user.perms?.files === "full";

  async function load() {
    setLoading(true);
    try {
      const officeQ = activeOfficeId !== "all" ? `?office=${activeOfficeId}` : "";
      const [fRes, oRes] = await Promise.all([
        fetch(`/api/files${officeQ}`),
        fetch("/api/offices"),
      ]);
      const fData = await fRes.json();
      const oData = await oRes.json();
      if (fRes.ok) setFiles(fData.files || []);
      if (oRes.ok) setOffices(oData.offices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeOfficeId]);

  function openCreate() {
    setSelectedFile(null);
    setUploadedBy(user.name);
    const presetOfficeId = !user.isSuperAdmin
      ? user.officeId || ""
      : activeOfficeId !== "all"
      ? activeOfficeId
      : "";
    setOfficeId(presetOfficeId);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("اختر ملفاً أولاً");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("uploadedBy", uploadedBy);
      fd.append("officeId", officeId);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الرفع");
      toast.success("تم رفع الملف");
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
        title="الملفات المرفوعة"
        description="تُخزّن الملفات على القرص كمسارات — لا base64 في القاعدة [FIX 12]."
        action={canEdit && (
          <Button className="bg-gradient-to-l from-teal-500 to-emerald-600" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            رفع ملف
          </Button>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : files.length === 0 ? (
            <EmptyState title="لا توجد ملفات" icon={Paperclip} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الملف</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحجم</TableHead>
                    <TableHead>رفع بواسطة</TableHead>
                    {user.isSuperAdmin && <TableHead>المكتب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => {
                    const Icon = fileIcon(f.type);
                    const office = offices.find((o) => o.id === f.officeId);
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="font-medium text-sm">{f.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">{f.type || "—"}</TableCell>
                        <TableCell className="text-sm">{formatSize(f.size)}</TableCell>
                        <TableCell className="text-sm">{f.uploadedBy || "—"}</TableCell>
                        {user.isSuperAdmin && (
                          <TableCell>
                            <OfficeBadge officeId={f.officeId} officeName={office?.name} color={office?.color} />
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>رفع ملف</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 py-2">
            <div className="space-y-2">
              <Label>الملف</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
              >
                {selectedFile ? (
                  <div>
                    <FileText className="w-8 h-8 mx-auto text-teal-600 mb-2" />
                    <div className="font-medium text-sm">{selectedFile.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatSize(selectedFile.size)}</div>
                  </div>
                ) : (
                  <div>
                    <Plus className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <div className="text-sm text-slate-500">انقر لاختيار ملف</div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>رفع بواسطة</Label>
              <Input value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} />
            </div>
            {user.isSuperAdmin && (
              <div className="space-y-2">
                <Label>المكتب *</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-gradient-to-l from-teal-500 to-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                رفع
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
