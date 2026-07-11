import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
]);

const EBOOK_MIME = new Set([
  "application/pdf",
  "application/epub+zip",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const MAX_DEFAULT_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_EBOOK_SIZE = 300 * 1024 * 1024; // 300 MB

const InputSchema = z.object({
  folder: z.enum(["avatars", "profile", "uploads", "docs", "internal-docs", "ebooks"]).default("uploads"),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(150),
  size: z.number().int().positive().max(MAX_EBOOK_SIZE),
});

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!ALLOWED_MIME.has(data.contentType)) {
      throw new Error("Unsupported file type");
    }
    const { createPresignedPutUrl } = await import("@/lib/r2.server");

    const ext = data.filename.includes(".")
      ? data.filename.slice(data.filename.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
      : "";
    const safeExt = ext ? `.${ext}` : "";
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const key = `${data.folder}/${context.userId}/${Date.now()}-${rand}${safeExt}`;

    const { uploadUrl, publicUrl } = await createPresignedPutUrl({
      key,
      contentType: data.contentType,
      expiresInSeconds: 600,
    });

    return { uploadUrl, publicUrl, key, contentType: data.contentType };
  });
