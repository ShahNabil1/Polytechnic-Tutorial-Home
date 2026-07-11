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

export type SubjectPlacement = {
  department_id: string;
  semester_id: string;
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
  placements: SubjectPlacement[];
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

export type LmsCourse = {
  id: string;
  department_id: string;
  semester_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  price_bdt: number;
  compare_at_price_bdt: number | null;
  is_active: boolean;
  sort_order: number;
  subject_count?: number;
  created_at: string;
  updated_at: string;
};


export type LmsEnrollment = {
  id: string;
  user_id: string;
  course_id: string;
  order_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined
  user_email?: string | null;
  user_full_name?: string | null;
};

export type LmsCourseCatalogItem = LmsCourse & {
  department_name: string;
  department_slug: string;
  semester_name: string;
  semester_slug: string;
  has_access: boolean;
};

export type LmsCourseContent = {
  course: LmsCourse;
  department: AcademicCategory;
  semester: AcademicCategory;
  has_access: boolean;
  subjects: Array<
    LmsSubject & {
      modules: Array<LmsModuleWithLessons>;
    }
  >;
};
