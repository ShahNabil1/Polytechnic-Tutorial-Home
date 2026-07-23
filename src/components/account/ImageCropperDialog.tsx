import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut, RotateCw, X, Check } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type Props = {
  file: File;
  aspect?: number;
  cropShape?: "rect" | "round";
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
  submitLabel?: string;
};

export function ImageCropperDialog({
  file,
  aspect = 1,
  cropShape = "round",
  onCancel,
  onCropped,
  submitLabel = "কনফার্ম করুন",
}: Props) {
  const [imageSrc] = useState<string>(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropped, setCropped] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  useScrollLock(true);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCropped(pixels);
  }, []);

  async function handleConfirm() {
    if (!cropped) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, cropped, rotation);
      await onCropped(blob);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(imageSrc);
    }
  }

  function handleCancel() {
    URL.revokeObjectURL(imageSrc);
    onCancel();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" style={{ pointerEvents: "auto" }}>
      <div className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">ছবি ক্রপ করুন</h3>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative h-[320px] w-full bg-neutral-950 sm:h-[400px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-brand"
            />
            <ZoomIn className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <RotateCw className="size-3.5" /> ঘোরান
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy || !cropped}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

async function getCroppedBlob(imageSrc: string, area: Area, rotation: number): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const rad = (rotation * Math.PI) / 180;

  // Draw the rotated image on an offscreen canvas, then crop.
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxWidth = image.width * cos + image.height * sin;
  const bBoxHeight = image.width * sin + image.height * cos;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = bBoxWidth;
  rotCanvas.height = bBoxHeight;
  const rotCtx = rotCanvas.getContext("2d")!;
  rotCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = area.width;
  outCanvas.height = area.height;
  const outCtx = outCanvas.getContext("2d")!;
  outCtx.drawImage(
    rotCanvas,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  return await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas is empty"))), "image/jpeg", 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
