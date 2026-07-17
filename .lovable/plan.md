# /workspace সম্পূর্ণ Cache Refactor Plan

## 🎯 লক্ষ্য

Workspace এর সব admin page কে `useEffect + useState + fetch` থেকে সরিয়ে **TanStack Query + Route Loader** pattern এ নিয়ে আসা। এতে:
- Tab switch করলে instant render (network call ছাড়া)
- Sidebar hover এ prefetch
- Mutation এর সাথে সঠিক invalidation
- ভারী aggregate query তে server-side Redis cache

## 📊 Scope (18 core component, ~7,100 লাইন)

### Group A — E-commerce Admin (5)
- `AdminProductsManager` (864) — products + bundles list
- `AdminBundlesManager` (723) — bundle CRUD
- `AdminOrdersManager` (590) — order list, filter, drawer
- `AdminCategoriesManager` (312) — category tree
- `AdminCouponsManager` (735) — coupon CRUD

### Group B — CRM (2)
- `CrmListPage` (457) — customers/guests/signed/incomplete tabs
- `AdminIncompleteCheckouts` (305)

### Group C — LMS (4)
- `AcademicStructureManager` (234) — dept → sem tree
- `SubjectsManager` (324)
- `CoursesManager` (324)
- `CurriculumBuilder` (354) — lessons

### Group D — Users (1)
- `AdminUsersManagerEN` (293) — employees + instructors

### Group E — CMS (4)
- `SiteSettingsEditor` (101)
- `HomepageEditor` (455)
- `StaticPagesEditor` (76)
- `SeoEditor` (86)

### Group F — Templates (2)
- `EmailTemplatesManager` (497)
- `SmsTemplatesManager` (398)

## 🏗️ Refactor Pattern (প্রতিটার জন্য একই)

প্রতি component এ:

1. **`queryOptions` factory** — কোথাও centralized (`src/lib/admin-queries.ts`) না অথবা component top:
   ```ts
   const productsQuery = queryOptions({
     queryKey: ['admin', 'products'],
     queryFn: () => listAdminProductsFn(),
     staleTime: 2 * 60_000,
   });
   ```

2. **Route loader** — `context.queryClient.ensureQueryData(productsQuery)`

3. **Component read** — `const { data } = useSuspenseQuery(productsQuery)`

4. **Mutations** — `useMutation` + `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })`

5. **`useEffect` fetch গুলো সব সরানো**

## 🔑 Query Key ও staleTime Convention

| Key | staleTime | Rationale |
|---|---|---|
| `['admin','products']` | 2m | দ্রুত পাল্টায়, kaঁচা edit দেখা দরকার |
| `['admin','bundles']` | 2m | সাথে products invalidate হয় |
| `['admin','categories']` | 10m | কালেভদ্রে পাল্টায় |
| `['admin','coupons']` | 5m | |
| `['admin','orders',filters]` | 30s | new order জরুরি |
| `['admin','crm',kind,filters]` | 1m | |
| `['admin','incomplete']` | 30s | live checkout |
| `['admin','lms','structure']` | 10m | rare edit |
| `['admin','lms','subjects']` | 10m | |
| `['admin','lms','courses',dept,sem]` | 5m | |
| `['admin','lms','curriculum',slug]` | 5m | |
| `['admin','users',role]` | 5m | |
| `['admin','cms','site']` | 10m | |
| `['admin','cms','homepage']` | 10m | |
| `['admin','cms','pages']` | 10m | |
| `['admin','cms','seo',path]` | 10m | |
| `['admin','email-templates']` | 10m | |
| `['admin','sms-templates']` | 10m | |

## 🔁 Invalidation Rules

সব admin mutation এ:

- `products` edit → invalidate `['admin','products']` + public `['courses']` (LMS pages public)
- `categories` edit → invalidate `['admin','categories']` + `['admin','products']`
- `coupons` edit → invalidate `['admin','coupons']`
- `orders` status change → invalidate `['admin','orders']` + `['admin','crm']`
- `lms/*` edit → invalidate `['admin','lms',*]` + ইতিমধ্যে থাকা server-side `invalidateLmsCaches()`
- `cms/*` save → invalidate `['admin','cms',*]` (server-side Redis cache আগেই invalidate হয়)
- Server-side (Redis) invalidation যেখানে আছে সেটা রেখে দেয়া হবে, শুধু client cache যোগ হবে

## 🔴 এড়ানো হবে

- Edit form initial data cache — form open এ fresh fetch (edit form এর অভ্যন্তরীণ state)
- Auth / permission check
- File upload flow

## 📅 Execution Order

ছোট থেকে বড় — যাতে pattern verify করা যায় আগে বড় গুলো ধরার আগে:

1. **Wave 1** (CMS + সহজ): SiteSettingsEditor, StaticPagesEditor, SeoEditor, HomepageEditor
2. **Wave 2** (LMS): AcademicStructureManager, SubjectsManager, CoursesManager, CurriculumBuilder
3. **Wave 3** (Users + Templates): AdminUsersManagerEN, EmailTemplatesManager, SmsTemplatesManager
4. **Wave 4** (Ecommerce): AdminCategoriesManager, AdminCouponsManager, AdminProductsManager, AdminBundlesManager, AdminOrdersManager
5. **Wave 5** (CRM): CrmListPage, AdminIncompleteCheckouts

প্রতি wave এর পর build/typecheck দিয়ে verify হবে।

## ✅ Success Criteria

- সব `useEffect(() => { fetchXxx() }, [])` সরানো হয়েছে
- Tab এ ফিরলে network tab এ 0 request (fresh সময়ে)
- সব admin edit এর পর UI তাৎক্ষণিক refresh হচ্ছে (invalidation কাজ করছে)
- Build green, existing functionality অক্ষুণ্ণ

## 📝 Notes

- Route loader গুলো `_authenticated` এর নিচে থাকায় auth-token available, তাই server function call সেফ
- বড় component গুলোতে অনেক sub-fetch থাকতে পারে (dropdown options, sub-list), প্রতিটা আলাদা query key পাবে
- Estimate: প্রায় 25-35টা tool call — Wave-by-Wave execute করা হবে
