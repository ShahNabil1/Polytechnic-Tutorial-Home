
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS media_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill media_items from existing cover_image_url when empty
UPDATE public.lms_courses
SET media_items = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'image',
    'url', cover_image_url
  )
)
WHERE cover_image_url IS NOT NULL
  AND cover_image_url <> ''
  AND (media_items IS NULL OR jsonb_array_length(media_items) = 0);
