import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { upsertSubject } from "@/lib/lms.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import type { AcademicCategory, LmsSubject, SubjectPlacement } from "@/lib/lms";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [placements, setPlacements] = useState<SubjectPlacement[]>([]);
  const [newDept, setNewDept] = useState<string>("");
  const [newSem, setNewSem] = useState<string>("");
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
      setPlacements(subject?.placements ?? []);
      setNewDept("");
      setNewSem("");
      setSlugManuallyEdited(!!subject);
    }
  }, [open, subject]);

  useEffect(() => {
    if (!slugManuallyEdited) setSlug(slugify(name));
  }, [name, slugManuallyEdited]);

  const departments = useMemo(
    () => taxonomy.filter((t) => t.kind === "department").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );
  const semesters = useMemo(
    () => taxonomy.filter((t) => t.kind === "semester").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );
  const byId = useMemo(() => new Map(taxonomy.map((t) => [t.id, t])), [taxonomy]);

  function addPlacement() {
    if (!newDept || !newSem) {
      toast.error("Select both department and semester");
      return;
    }
    if (placements.some((p) => p.department_id === newDept && p.semester_id === newSem)) {
      toast.error("This pair is already added");
      return;
    }
    setPlacements((prev) => [...prev, { department_id: newDept, semester_id: newSem }]);
    setNewDept("");
    setNewSem("");
  }

  function removePlacement(idx: number) {
    setPlacements((prev) => prev.filter((_, i) => i !== idx));
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
            placements,
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
            <Label className="mb-2 block">Placements (Department · Semester)</Label>
            <p className="text-xs text-slate-500 mb-2">
              Add one pair per department-semester where this subject appears. Same subject in Civil 1st and Computer 2nd? Add both pairs.
            </p>

            {departments.length === 0 || semesters.length === 0 ? (
              <p className="text-xs text-amber-600">
                Add departments and semesters in Academic Structure first.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Department</Label>
                    <Select value={newDept} onValueChange={setNewDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Semester</Label>
                    <Select value={newSem} onValueChange={setNewSem}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {semesters.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={addPlacement} className="shrink-0">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>

                {placements.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {placements.map((p, idx) => {
                      const d = byId.get(p.department_id);
                      const s = byId.get(p.semester_id);
                      return (
                        <span
                          key={`${p.department_id}:${p.semester_id}:${idx}`}
                          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 pl-3 pr-1 py-1 text-xs font-medium text-indigo-700"
                        >
                          {d?.name ?? "?"} · {s?.name ?? "?"}
                          <button
                            type="button"
                            onClick={() => removePlacement(idx)}
                            className="rounded-full p-0.5 hover:bg-indigo-100"
                            aria-label="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
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
