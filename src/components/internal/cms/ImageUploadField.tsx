import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/upload-client";
import { TextInput } from "./FormPrimitives";

export function ImageUploadField({
  value,
  onChange,
  placeholder = "https://…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("শুধু ইমেজ ফাইল আপলোড করা যাবে");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadFileToR2(file, {
        folder: "uploads",
        onProgress: setProgress,
      });
      onChange(url);
      toast.success("ইমেজ আপলোড হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <TextInput
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {uploading ? `${progress}%` : "Upload"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <img src={value} alt="preview" className="h-12 w-20 rounded object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
