import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { upsertCourse } from "@/lib/lms.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import type { AcademicCategory, LmsCourse } from "@/lib/lms";
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
  course: LmsCourse | null;
  taxonomy: AcademicCategory[];
  fixedDeptId?: string;
  fixedSemId?: string;
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
    .slice(0, 100);
}

export function CourseFormDialog({
  open,
  course,
  taxonomy,
  fixedDeptId,
  fixedSemId,
  onClose,
  onSaved,
}: Props) {
  const upsertFn = useServerFn(upsertCourse);
  const [deptId, setDeptId] = useState("");
  const [semId, setSemId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [compareAt, setCompareAt] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const departments = useMemo(
    () => taxonomy.filter((t) => t.kind === "department").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );
  const semesters = useMemo(
    () => taxonomy.filter((t) => t.kind === "semester").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );

  useEffect(() => {
    if (open) {
      setDeptId(course?.department_id ?? fixedDeptId ?? "");
      setSemId(course?.semester_id ?? fixedSemId ?? "");
      setTitle(course?.title ?? "");
      setSlug(course?.slug ?? "");
      setDescription(course?.description ?? "");
      setCoverUrl(course?.cover_image_url ?? "");
      setPrice(String(course?.price_bdt ?? 0));
      setCompareAt(course?.compare_at_price_bdt != null ? String(course.compare_at_price_bdt) : "");
      setIsActive(course?.is_active ?? true);
      setSortOrder(course?.sort_order ?? 0);
      setSlugEdited(!!course);
    }
  }, [open, course, fixedDeptId, fixedSemId]);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

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
    if (!deptId || !semId) {
      toast.error("Select department and semester");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const priceNum = Number(price) || 0;
      const compareNum = compareAt.trim() ? Number(compareAt) : null;
      await upsertFn({
        data: {
          id: course?.id,
          department_id: deptId,
          semester_id: semId,
          patch: {
            title: title.trim(),
            slug: slug.trim() || slugify(title),
            description: description.trim() || null,
            cover_image_url: coverUrl || null,
            price_bdt: priceNum,
            compare_at_price_bdt: compareNum,
            is_active: isActive,
            sort_order: sortOrder,
          },
        },
      } as never);
      toast.success(course ? "Course updated" : "Course created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const pairLocked = !!(fixedDeptId && fixedSemId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : "Add Course"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Department *</Label>
              <Select value={deptId} onValueChange={setDeptId} disabled={pairLocked || !!course}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semester *</Label>
              <Select value={semId} onValueChange={setSemId} disabled={pairLocked || !!course}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="crs-title">Title *</Label>
            <Input id="crs-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Computer — 1st Semester" />
          </div>

          <div>
            <Label htmlFor="crs-slug">Slug</Label>
            <Input
              id="crs-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
              placeholder="computer-1st-sem"
            />
          </div>

          <div>
            <Label>Cover Image</Label>
            <div className="mt-1 flex items-center gap-3">
              {coverUrl ? (
                <div className="relative">
                  <img src={coverUrl} alt="cover" className="h-24 w-40 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setCoverUrl("")} className="absolute -top-2 -right-2 bg-white rounded-full border p-1 shadow">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className={cn("h-24 w-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:bg-slate-50", uploading && "opacity-50 pointer-events-none")}>
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><Upload className="w-5 h-5 mb-1" /><span className="text-xs">Upload</span></>)}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="crs-desc">Description</Label>
            <Textarea id="crs-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What students learn in this course..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="crs-price">Price (৳) *</Label>
              <Input id="crs-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="crs-compare">Compare-at (৳)</Label>
              <Input id="crs-compare" type="number" min="0" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="crs-order">Sort order</Label>
              <Input id="crs-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="crs-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="crs-active">Active (visible to students)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {course ? "Save Changes" : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
