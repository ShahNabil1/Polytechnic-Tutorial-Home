import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  IdCard,
  Loader2,
  Upload,
  Camera,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  getMyInternalProfile,
  updateMyInternalProfile,
  getInternalDocSignedUrl,
  type InternalProfile,
} from "@/lib/internal-profile.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { cn } from "@/lib/utils";

type Side = "front" | "back";

type PickedFile = { side: Side; file: File } | null;

export function NidUploadCard() {
  const load = useServerFn(getMyInternalProfile);
  const save = useServerFn(updateMyInternalProfile);
  const signUrl = useServerFn(getInternalDocSignedUrl);

  const [profile, setProfile] = useState<InternalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingSide, setUploadingSide] = useState<Side | null>(null);
  const [pct, setPct] = useState(0);
  const [picked, setPicked] = useState<PickedFile>(null);

  const uploadFrontRef = useRef<HTMLInputElement>(null);
  const uploadBackRef = useRef<HTMLInputElement>(null);
  const cameraFrontRef = useRef<HTMLInputElement>(null);
  const cameraBackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(undefined as never)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => toast.error("Load failed: " + (err as Error).message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function handlePick(side: Side, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setPicked({ side, file });
    // Reset all inputs so the same file can be picked again
    if (uploadFrontRef.current) uploadFrontRef.current.value = "";
    if (uploadBackRef.current) uploadBackRef.current.value = "";
    if (cameraFrontRef.current) cameraFrontRef.current.value = "";
    if (cameraBackRef.current) cameraBackRef.current.value = "";
  }

  async function handleCropped(blob: Blob) {
    if (!picked) return;
    const side = picked.side;
    setPicked(null);
    setUploadingSide(side);
    setPct(0);
    try {
      const filename = `nid-${side}-${Date.now()}.jpg`;
      const croppedFile = new File([blob], filename, { type: "image/jpeg" });
      const { key } = await uploadFileToR2(croppedFile, {
        folder: "internal-docs",
        onProgress: setPct,
        compress: { maxSizeMB: 1.5, maxWidthOrHeight: 1600, useWebWorker: true },
      });
      const patch =
        side === "front" ? { nid_front_r2_key: key } : { nid_back_r2_key: key };
      await save({ data: patch });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...patch,
              nid_resubmit_requested_at: null,
              nid_resubmit_reason: null,
            }
          : prev,
      );
      toast.success(`NID ${side} photo uploaded`);
    } catch (err) {
      toast.error("Upload failed: " + (err as Error).message);
    } finally {
      setUploadingSide(null);
    }
  }

  async function openImage(side: Side) {
    const key =
      side === "front" ? profile?.nid_front_r2_key : profile?.nid_back_r2_key;
    if (!key) return;
    try {
      const { url } = await signUrl({ data: { key } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error("Failed to open: " + (err as Error).message);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </section>
    );
  }

  const resubmitRequested = !!profile?.nid_resubmit_requested_at;
  const hasFront = !!profile?.nid_front_r2_key;
  const hasBack = !!profile?.nid_back_r2_key;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <IdCard className="size-4 text-indigo-600" />
          <h2 className="font-display text-base font-bold tracking-tight">
            NID Photo (Front &amp; Back)
          </h2>
          {hasFront && hasBack && !resubmitRequested && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="size-3" /> Submitted
            </span>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <AlertTriangle className="size-3.5" /> Instructions
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Photo must be clear, sharp, and fully visible — no glare or blur.</li>
            <li>All four corners of the card must be inside the frame.</li>
            <li>Upload the front and back sides separately.</li>
            <li>You can upload from a file or open the camera to take a photo.</li>
          </ul>
        </div>

        {resubmitRequested && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
            <div className="mb-1 flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              Admin has requested you resubmit your NID photos.
            </div>
            {profile?.nid_resubmit_reason && (
              <div className="mt-1 text-xs font-medium text-red-700">
                Reason: {profile.nid_resubmit_reason}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <NidSlot
            side="front"
            hasImage={hasFront}
            uploading={uploadingSide === "front"}
            pct={pct}
            onOpen={() => openImage("front")}
            onUploadClick={() => uploadFrontRef.current?.click()}
            onCameraClick={() => cameraFrontRef.current?.click()}
          />
          <NidSlot
            side="back"
            hasImage={hasBack}
            uploading={uploadingSide === "back"}
            pct={pct}
            onOpen={() => openImage("back")}
            onUploadClick={() => uploadBackRef.current?.click()}
            onCameraClick={() => cameraBackRef.current?.click()}
          />
        </div>

        {/* Hidden file inputs */}
        <input
          ref={uploadFrontRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePick("front", e)}
        />
        <input
          ref={uploadBackRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePick("back", e)}
        />
        <input
          ref={cameraFrontRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePick("front", e)}
        />
        <input
          ref={cameraBackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePick("back", e)}
        />
      </section>

      {picked && (
        <ImageCropperDialog
          file={picked.file}
          aspect={1.586}
          cropShape="rect"
          onCancel={() => setPicked(null)}
          onCropped={handleCropped}
          submitLabel="Upload"
        />
      )}
    </>
  );
}

function NidSlot({
  side,
  hasImage,
  uploading,
  pct,
  onOpen,
  onUploadClick,
  onCameraClick,
}: {
  side: Side;
  hasImage: boolean;
  uploading: boolean;
  pct: number;
  onOpen: () => void;
  onUploadClick: () => void;
  onCameraClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {side === "front" ? "Front side" : "Back side"}
        </div>
        {hasImage && (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Uploaded
          </span>
        )}
      </div>
      <div
        className={cn(
          "mb-3 grid aspect-[1.586] place-items-center overflow-hidden rounded-md border border-dashed",
          hasImage ? "border-emerald-300 bg-white" : "border-slate-300 bg-white",
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-500">
            <Loader2 className="size-5 animate-spin" />
            Uploading... {pct}%
          </div>
        ) : hasImage ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
          >
            <ExternalLink className="size-3.5" /> View {side}
          </button>
        ) : (
          <div className="text-xs font-semibold text-slate-400">
            No photo yet
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
        >
          <Upload className="size-3.5" /> {hasImage ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          onClick={onCameraClick}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
        >
          <Camera className="size-3.5" /> Camera
        </button>
      </div>
    </div>
  );
}
