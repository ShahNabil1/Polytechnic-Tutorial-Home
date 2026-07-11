# Department–Semester Bundles (Courses)

প্রতিটা (Department, Semester) pair কে একটা "কোর্স/বান্ডেল" হিসেবে treat করব। Admin ও student — দুই দিকেই এই pair-ই central unit।

---

## User flow

**Admin side**

1. `/workspace/lms-and-courses/courses` — সব (dept × semester) pair grid হিসেবে দেখাবে (কম্পিউটার ১ম, কম্পিউটার ২য়, সিভিল ১ম … )। প্রতিটা কার্ডে: cover, price, active toggle, subject count, "Manage" বাটন।
2. কার্ডে ঢুকলে (`/courses/$dept/$sem`) — ওই pair-এর সব সাব্জেক্টের লিস্ট (already-filtered subjects manager)। এখান থেকে সাব্জেক্ট এ্যাড করলে placement auto-filled থাকবে (এখন যেভাবে হচ্ছে)।
3. সাব্জেক্টে ঢুকলে → বর্তমান `CurriculumBuilder` (modules + lessons) — কোনো পরিবর্তন লাগবে না।
4. কার্ডেই price, cover images (max 5) + cover video (optional, max -1), description, active/inactive, compare price, meta title, meta description সেট করা যাবে (inline edit বা edit dialog)।

**Student side**

1. `/sdash/courses` — user দেখবে সব available (dept, sem) কোর্স কার্ড, প্রাইস সহ।
2. "Enroll / Buy" ক্লিক করলে existing checkout flow দিয়ে যাবে (order + payment)।
3. Payment confirm হলে user-কে ওই course access grant হবে automatically।
4. Enrolled user "My Courses"-এ যাবে → subjects → modules → lessons (video player)। Access না থাকলে শুধু `is_free=true` lesson দেখতে পারবে।

---

## Data model

নতুন টেবিল:

- `**lms_courses**` — এক (department, semester) pair-এ এক row।
fields: `department_id`, `semester_id`, `title`, `slug`, `description`, `cover_image_url`, `price_bdt`, `compare_at_price_bdt`, `is_active`, `sort_order`।
unique(`department_id`, `semester_id`)।
- `**lms_enrollments**` — কোন user কোন course-এ enrolled।
fields: `user_id`, `course_id`, `order_id` (nullable — admin manual grant হলে null), `granted_at`, `expires_at` (nullable = lifetime)।
unique(`user_id`, `course_id`)।

Access rule (helper function `public.has_course_access(_user, _course)`):
`is_super_admin OR (enrollment exists AND (expires_at IS NULL OR expires_at > now()))`।

একটা lesson-এ access আছে কিনা check করার জন্য:
lesson → module → subject → subject's placements → matching (dept, sem) pair → course → enrollment।

**Order integration**

- Existing `order_items.item_type` এ নতুন value `'lms_course'` যোগ (বা new nullable `course_id` column)।
- Order status = `delivered`/`paid` হলে trigger বা server-fn call করে `lms_enrollments` row insert করবে।

**Existing bundles**
`product_bundles` shop-এর physical/ebook bundle-এর জন্য। LMS courses আলাদা টেবিলে রাখব — উদ্দেশ্য আলাদা (recurring pattern per dept×sem, curriculum-linked, digital access), mixing করলে schema টা ঘোলা হয়ে যাবে।

---

## Implementation phases

**Phase 1 — Course entity + admin grid (এই ধাপে ship করব)**

- Migration: `lms_courses` table + RLS + grants।
- Server fns: `listCourses`, `getCourseByPair`, `upsertCourse`, `deleteCourse`, auto-generate rows for every (dept × sem) pair on demand (একটা "Generate missing" বাটন)।
- Admin route `/workspace/lms-and-courses/courses` — grid of cards with price/cover/active।
- Admin route `/workspace/lms-and-courses/courses/$dept/$sem` — filtered SubjectsManager (reuse) + course edit panel।
- Sidebar-এ "Courses" link যোগ।

**Phase 2 — Enrollments + access control**

- Migration: `lms_enrollments` + `has_course_access` RPC।
- Server fns: `listMyCourses`, `enrollUserManual` (admin), lesson fetch হবে access-check করে।
- Admin: enrollment manager page (grant/revoke)।

**Phase 3 — Student LMS UI**

- `/sdash/courses` — available courses browse + "My Courses" tab।
- Course detail → subjects list → CurriculumViewer (lesson player, free-preview support)।

**Phase 4 — Purchase flow**

- Cart/checkout support for `lms_course` item type।
- Order-delivered trigger → auto-create enrollment row।
- "Buy" button on student course card → add to cart → checkout → auto-access।

---

## এই approval-এ শুধু Phase 1 ship করব

Phase 2–4 আলাদা turn-এ। Phase 1 নিজেই admin-এর "কম্পিউটার ১ম সেমিস্টার" cards ও সেগুলোর curriculum management complete করে দেবে। Enrollment/purchase পরের phase-এ।

Phase 1 approve করলে migration + code এক এক করে যাবে। এটাতে ঠিক আছে, নাকি অন্যরকম চান জানালে plan revise করে দেব।