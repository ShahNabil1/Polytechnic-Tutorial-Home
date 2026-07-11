import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X, Sparkles, Link as LinkIcon, Film } from "lucide-react";
import { toast } from "sonner";
import { upsertLesson } from "@/lib/lms.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import type { LessonVideoProvider, LmsLesson } from "@/lib/lms";
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
  moduleId: string;
  lesson: LmsLesson | null;
  onClose: () => void;
  onSaved: () => void;
};

function detectProvider(url: string): LessonVideoProvider {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes(".mp4") || u.includes(".webm") || u.includes(".mov")) {
    if (u.includes("r2.cloudflarestorage") || u.includes("r2.dev")) return "r2";
    return "external";
  }
  return "external";
}

export function LessonFormDialog({ open, moduleId, lesson, onClose, onSaved }: Props) {
  const upsertFn = useServerFn(upsertLesson);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoProvider, setVideoProvider] = useState<LessonVideoProvider>("r2");

  useEffect(() => {
    if (open) {
      setTitle(lesson?.title ?? "");
      setDescription(lesson?.description ?? "");
      setVideoUrl(lesson?.video_url ?? "");
      setThumbnailUrl(lesson?.thumbnail_url ?? "");
      setIsFree(lesson?.is_free ?? false);
      setVideoProvider(lesson?.video_provider ?? "r2");
      setVideoProgress(0);
    }
  }, [open, lesson]);

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setVideoProgress(0);
    try {
      const { url } = await uploadFileToR2(file, {
        folder: "lms-videos",
        compress: false,
        onProgress: (p) => setVideoProgress(p),
      });
      setVideoUrl(url);
      setVideoProvider("r2");
      toast.success("Video uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Video upload failed");
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  }

  async function handleThumbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const { url } = await uploadFileToR2(file, {
        folder: "lms-thumbs",
        compress: { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true },
      });
      setThumbnailUrl(url);
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploadingThumb(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const provider = videoUrl ? (videoProvider ?? detectProvider(videoUrl)) : "r2";
      await upsertFn({
        data: {
          id: lesson?.id,
          patch: {
            module_id: moduleId,
            title: title.trim(),
            description: description.trim() || null,
            video_url: videoUrl.trim() || null,
            video_provider: provider,
            thumbnail_url: thumbnailUrl || null,
            duration_seconds: lesson?.duration_seconds ?? null,
            is_free: isFree,
            sort_order: lesson?.sort_order ?? 0,
          },
        },
      } as never);
      toast.success(lesson ? "Lesson updated" : "Lesson created");
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
          <DialogTitle>{lesson ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="l-title">Title *</Label>
            <Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson 1: Introduction" />
          </div>

          <div>
            <Label htmlFor="l-desc">Description</Label>
            <Textarea
              id="l-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this lesson covers..."
            />
          </div>

          <div>
            <Label>Thumbnail</Label>
            <div className="mt-1 flex items-center gap-3">
              {thumbnailUrl ? (
                <div className="relative">
                  <img src={thumbnailUrl} alt="thumb" className="h-20 w-32 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl("")}
                    className="absolute -top-2 -right-2 bg-white rounded-full border p-1 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    "h-20 w-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:bg-slate-50",
                    uploadingThumb && "opacity-50 pointer-events-none",
                  )}
                >
                  {uploadingThumb ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mb-1" />
                      <span className="text-[10px]">Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label>Video</Label>
            <div className="mt-1 space-y-2">
              {videoUrl && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center gap-2 text-xs">
                  <Film className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="flex-1 truncate">{videoUrl}</span>
                  <button
                    type="button"
                    onClick={() => setVideoUrl("")}
                    className="text-slate-500 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label
                  className={cn(
                    "flex-1 h-10 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 cursor-pointer text-sm text-slate-600 hover:bg-slate-50",
                    uploadingVideo && "opacity-50 pointer-events-none",
                  )}
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading {videoProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload video to R2</span>
                    </>
                  )}
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </label>
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="…or paste YouTube / Vimeo / direct mp4 URL"
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setVideoProvider(detectProvider(e.target.value));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <Label htmlFor="is-free" className="font-semibold text-slate-900 cursor-pointer">
                    Set as Free / Demo
                  </Label>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  When enabled, any student can watch this lesson without purchasing the course.
                </p>
              </div>
              <Switch id="is-free" checked={isFree} onCheckedChange={setIsFree} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploadingVideo || uploadingThumb}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {lesson ? "Save Changes" : "Create Lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
