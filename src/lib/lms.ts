// Shared LMS types. Data lives in Supabase; see lms.functions.ts.

export type AcademicKind = "department" | "semester";

export type AcademicCategory = {
  id: string;
  kind: AcademicKind;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type LmsSubject = {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  department_ids: string[];
  semester_ids: string[];
  module_count?: number;
  lesson_count?: number;
  created_at: string;
  updated_at: string;
};

export type LmsModule = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LessonVideoProvider = "r2" | "youtube" | "vimeo" | "external";

export type LmsLesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: LessonVideoProvider;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_free: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LmsModuleWithLessons = LmsModule & { lessons: LmsLesson[] };
