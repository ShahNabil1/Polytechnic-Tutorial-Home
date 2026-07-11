import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X, Check } from "lucide-react";
import { toast } from "sonner";
import { upsertSubject } from "@/lib/lms.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import type { AcademicCategory, LmsSubject } from "@/lib/lms";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  subject: LmsSubject | null;
  taxonomy: AcademicCategory[];
  onClose: () => void;
  onSaved: () => void;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function SubjectFormDialog({ open, subject, taxonomy, onClose, onSaved }: Props) {
  const upsertFn = useServerFn(upsertSubject);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [semIds, setSemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setName(subject?.name ?? "");
      setCode(subject?.code ?? "");
      setSlug(subject?.slug ?? "");
      setDescription(subject?.description ?? "");
      setCoverUrl(subject?.cover_image_url ?? "");
      setIsActive(subject?.is_active ?? true);
      setDeptIds(subject?.department_ids ?? []);
      setSemIds(subject?.semester_ids ?? []);
      setSlugManuallyEdited(!!subject);
    }
  }, [open, subject]);

  useEffect(() => {
    if (!slugManuallyEdited) setSlug(slugify(name));
  }, [name, slugManuallyEdited]);

  const departments = taxonomy.filter((t) => t.kind === "department");
  const semesters = taxonomy.filter((t) => t.kind === "semester");

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFileToR2(file, {
        folder: "uploads",
        compress: { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true },
      });
      setCoverUrl(url);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: subject?.id,
          patch: {
            name: name.trim(),
            code: code.trim() || null,
            slug: slug.trim() || slugify(name),
            description: description.trim() || null,
            cover_image_url: coverUrl || null,
            is_active: isActive,
            sort_order: subject?.sort_order ?? 0,
            department_ids: deptIds,
            semester_ids: semIds,
          },
        },
      } as never);
      toast.success(subject ? "Subject updated" : "Subject created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subject ? "Edit Subject" : "Add Subject"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subj-name">Subject Name *</Label>
              <Input id="subj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" />
            </div>
            <div>
              <Label htmlFor="subj-code">Code</Label>
              <Input id="subj-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MATH-101" />
            </div>
          </div>

          <div>
            <Label htmlFor="subj-slug">Slug</Label>
            <Input
              id="subj-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugManuallyEdited(true);
              }}
              placeholder="mathematics"
            />
            <p className="text-xs text-slate-500 mt-1">URL identifier. Auto-generated from name.</p>
          </div>

          <div>
            <Label>Cover Image</Label>
            <div className="mt-1 flex items-center gap-3">
              {coverUrl ? (
                <div className="relative">
                  <img src={coverUrl} alt="cover" className="h-24 w-40 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setCoverUrl("")}
                    className="absolute -top-2 -right-2 bg-white rounded-full border p-1 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    "h-24 w-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:bg-slate-50",
                    uploading && "opacity-50 pointer-events-none",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mb-1" />
                      <span className="text-xs">Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="subj-desc">Description</Label>
            <Textarea
              id="subj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief overview of the subject..."
            />
          </div>

          <div>
            <Label className="mb-2 block">Departments</Label>
            {departments.length === 0 ? (
              <p className="text-xs text-slate-500">No departments yet — add them in Academic Structure.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => {
                  const active = deptIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggle(deptIds, d.id, setDeptIds)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-400",
                      )}
                    >
                      {active && <Check className="w-3 h-3 inline mr-1" />}
                      {d.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Semesters</Label>
            {semesters.length === 0 ? (
              <p className="text-xs text-slate-500">No semesters yet — add them in Academic Structure.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {semesters.map((s) => {
                  const active = semIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(semIds, s.id, setSemIds)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        active
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400",
                      )}
                    >
                      {active && <Check className="w-3 h-3 inline mr-1" />}
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch id="subj-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="subj-active">Active (visible to students)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {subject ? "Save Changes" : "Create Subject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
