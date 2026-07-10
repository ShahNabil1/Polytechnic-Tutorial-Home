import imageCompression from "browser-image-compression";
import { createUploadUrl } from "@/lib/uploads.functions";

export type UploadFolder = "avatars" | "profile" | "uploads" | "docs";

export type CompressOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
};

const DEFAULT_AVATAR_COMPRESSION: CompressOptions = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 512,
  useWebWorker: true,
};

const DEFAULT_IMAGE_COMPRESSION: CompressOptions = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function compressImageIfPossible(file: File, options?: CompressOptions): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  try {
    const compressed: Blob = await imageCompression(file, options ?? DEFAULT_IMAGE_COMPRESSION);
    return compressed instanceof File
      ? compressed
      : new File([compressed], file.name, { type: compressed.type || file.type });
  } catch {
    return file;
  }
}

/**
 * Compress (if image) and upload the file to Cloudflare R2 via a presigned URL.
 * Returns the final public URL.
 */
export async function uploadFileToR2(
  file: File,
  opts: {
    folder: UploadFolder;
    compress?: CompressOptions | false;
    onProgress?: (pct: number) => void;
  },
): Promise<{ url: string; key: string; contentType: string; size: number }> {
  let toUpload = file;
  if (opts.compress !== false && file.type.startsWith("image/")) {
    const compressOpts =
      opts.folder === "avatars"
        ? { ...DEFAULT_AVATAR_COMPRESSION, ...(opts.compress ?? {}) }
        : { ...DEFAULT_IMAGE_COMPRESSION, ...(opts.compress ?? {}) };
    toUpload = await compressImageIfPossible(file, compressOpts);
  }

  const { uploadUrl, publicUrl, key, contentType } = await createUploadUrl({
    data: {
      folder: opts.folder,
      filename: toUpload.name || "file",
      contentType: toUpload.type || "application/octet-stream",
      size: toUpload.size,
    },
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(toUpload);
  });

  return { url: publicUrl, key, contentType, size: toUpload.size };
}
