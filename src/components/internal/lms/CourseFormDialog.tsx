import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X, ImageIcon, Video, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { upsertCourse } from "@/lib/lms.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import type { AcademicCategory, CourseMediaItem, LmsCourse } from "@/lib/lms";
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

function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
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
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [media, setMedia] = useState<CourseMediaItem[]>([]);
  const [price, setPrice] = useState<string>("0");
  const [compareAt, setCompareAt] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const initRef = useRef(false);

  const departments = useMemo(
    () => taxonomy.filter((t) => t.kind === "department").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );
  const semesters = useMemo(
    () => taxonomy.filter((t) => t.kind === "semester").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );

  const imageCount = media.filter((m) => m.type === "image").length;
  const hasVideo = media.some((m) => m.type === "video");

  useEffect(() => {
    if (open) {
      setDeptId(course?.department_id ?? fixedDeptId ?? "");
      setSemId(course?.semester_id ?? fixedSemId ?? "");
      setTitle(course?.title ?? "");
      setSlug(course?.slug ?? "");
      setDescription(course?.description ?? "");
      setMetaTitle(course?.meta_title ?? "");
      setMetaDescription(course?.meta_description ?? "");
      const existingMedia = course?.media_items && course.media_items.length > 0
        ? course.media_items
        : course?.cover_image_url
          ? [{ id: newId(), type: "image" as const, url: course.cover_image_url }]
          : [];
      setMedia(existingMedia);
      setPrice(String(course?.price_bdt ?? 0));
      setCompareAt(course?.compare_at_price_bdt != null ? String(course.compare_at_price_bdt) : "");
      setIsActive(course?.is_active ?? true);
      setSortOrder(course?.sort_order ?? 0);
      setSlugEdited(!!course);
      initRef.current = false;
      dirtyRef.current = false;
    }
  }, [open, course, fixedDeptId, fixedSemId]);

  useEffect(() => {
    if (!open) return;
    if (!initRef.current) {
      initRef.current = true;
      return;
    }
    dirtyRef.current = true;
  }, [open, deptId, semId, title, slug, description, metaTitle, metaDescription, media, price, compareAt, isActive, sortOrder]);

  function attemptClose() {
    if (saving || uploading) return;
    if (dirtyRef.current) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
    }
    onClose();
  }

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (imageCount >= 5) {
      toast.error("সরবোচ্চ ৫টা ছবি");
      return;
    }
    setCropFile(f);
  }

  async function handleCropped(blob: Blob) {
    setCropFile(null);
    setUploading(true);
    try {
      const file = new File([blob], `course-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url } = await uploadFileToR2(file, {
        folder: "uploads",
        compress: { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true },
      });
      setMedia((prev) => [...prev, { id: newId(), type: "image", url }]);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (hasVideo) {
      toast.error("শুধু ১টা ভিডিও");
      return;
    }
    if (!f.type.startsWith("video/")) {
      toast.error("ভিডিও ফাইল বাছাই করুন");
      return;
    }
    if (f.size > 200 * 1024 * 1024) {
      toast.error("ভিডিও 200MB এর কম হতে হবে");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadFileToR2(f, { folder: "lms-videos", compress: false });
      setMedia((prev) => [...prev, { id: newId(), type: "video", url }]);
      toast.success("Video uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from == null || from === targetIndex) return;
    setMedia((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  async function handleSave() {
    if (!deptId || !semId) return toast.error("Select department and semester");
    if (!title.trim()) return toast.error("Title is required");
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
            meta_title: metaTitle.trim() || null,
            meta_description: metaDescription.trim() || null,
            media_items: media,
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
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
        <DialogContent
          className="max-w-3xl max-h-[92vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{course ? "Edit Course" : "Add Course"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Department *</Label>
                <Select value={deptId} onValueChange={setDeptId} disabled={pairLocked || !!course}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Semester *</Label>
                <Select value={semId} onValueChange={setSemId} disabled={pairLocked || !!course}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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

            {/* Media Gallery */}
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Media Gallery</Label>
                <span className="text-xs text-slate-500">
                  {imageCount}/5 images{hasVideo ? " · 1 video" : ""} · drag to reorder
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {media.map((m, idx) => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                  >
                    {m.type === "image" ? (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="relative h-full w-full bg-black">
                        <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 grid place-items-center bg-black/30">
                          <Video className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {idx === 0 ? "Cover" : `#${idx + 1}`}
                    </div>
                    <div className="absolute inset-0 flex items-start justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/30 to-transparent">
                      <div className="flex gap-1">
                        <span className="rounded bg-white/90 p-1 cursor-move" title="Drag to reorder">
                          <GripVertical className="w-3 h-3 text-slate-700" />
                        </span>
                        <button type="button" onClick={() => removeMedia(m.id)} className="rounded bg-white/90 p-1 hover:bg-red-50" title="Remove">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {imageCount < 5 && (
                  <button
                    type="button"
                    onClick={() => imageFileRef.current?.click()}
                    disabled={uploading}
                    className="aspect-video rounded-lg border-2 border-dashed border-slate-300 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-xs font-medium">
                        <ImageIcon className="w-4 h-4" /> Image
                      </div>
                    )}
                  </button>
                )}
                {!hasVideo && (
                  <button
                    type="button"
                    onClick={() => videoFileRef.current?.click()}
                    disabled={uploading}
                    className="aspect-video rounded-lg border-2 border-dashed border-slate-300 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-xs font-medium">
                        <Video className="w-4 h-4" /> Video
                      </div>
                    )}
                  </button>
                )}
              </div>
              <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickImage} />
              <input ref={videoFileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={onPickVideo} />
              <p className="mt-2 text-xs text-slate-500">
                First image is the cover / share preview. Images are cropped to 16:9 and compressed in the browser before upload.
              </p>
            </div>

            <div>
              <Label htmlFor="crs-desc">Description</Label>
              <Textarea id="crs-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What students learn in this course..." />
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/50">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">SEO</div>
              <div>
                <Label htmlFor="crs-meta-title">Meta Title</Label>
                <Input
                  id="crs-meta-title"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={title || "Overrides <title> on the course page"}
                  maxLength={200}
                />
                <div className="mt-1 text-[11px] text-slate-500">{metaTitle.length}/60 recommended</div>
              </div>
              <div>
                <Label htmlFor="crs-meta-desc">Meta Description</Label>
                <Textarea
                  id="crs-meta-desc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={2}
                  placeholder="Overrides the SEO description (recommended: ≤160 chars)"
                  maxLength={500}
                />
                <div className="mt-1 text-[11px] text-slate-500">{metaDescription.length}/160 recommended</div>
              </div>
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
            <Button variant="outline" onClick={attemptClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {course ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cropFile && (
        <ImageCropperDialog
          file={cropFile}
          aspect={16 / 9}
          cropShape="rect"
          onCancel={() => setCropFile(null)}
          onCropped={handleCropped}
          submitLabel="Save image"
        />
      )}
    </>
  );
}
