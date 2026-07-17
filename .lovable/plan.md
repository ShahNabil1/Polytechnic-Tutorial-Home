# Full CMS for Homepage, Static Pages & SEO

আপনি অনেক বড় একটা কাজ চাচ্ছেন। আমি এটাকে একটা পূর্ণাঙ্গ CMS হিসেবে বানাবো যাতে ভবিষ্যতেও নতুন পেইজ/সেকশন যোগ করা সহজ হয়।

## Scope

### 1. Homepage — সম্পূর্ণ ডায়নামিক
`/workspace/settings/homepage` এ ট্যাব/সেকশন আকারে সব কিছু এডিট করা যাবে:
- **Hero** — eyebrow, title (with highlight portion), subtitle, দুইটা CTA বাটনের টেক্সট + লিংক, featured card (badge, eyebrow, title, features list, price, footnote)
- **Stats bar** — ৪টা stat (value + label)
- **Courses section** — eyebrow, title (highlight), description, "সব কোর্স দেখুন" বাটন টেক্সট
- **Shop section** — eyebrow, title (highlight), description, বাটন টেক্সট
- **About section** — eyebrow, title (highlight), দুই paragraph, badge টেক্সট, তিনটা feature card (title + description)
- **Testimonials** — eyebrow, title (highlight), প্রতিটা রিভিউ (rating, text, নাম, ভূমিকা) — add/remove/reorder
- **FAQ** — eyebrow, title (highlight), description, প্রতিটা প্রশ্ন-উত্তর — add/remove/reorder
- **Final CTA** — badge, title (highlight), description, দুইটা বাটন

### 2. Site-wide Settings — `/workspace/settings/site`
- Brand name, tagline, logo
- **Contact** — address, email, phone
- **Social links** — Facebook, Instagram, WhatsApp (real brand SVG icons; user paste করবে full URL, empty হলে icon hide)
- Footer copyright text, description

### 3. Static Pages — `/workspace/settings/pages`
এডিটেবল পেইজ: `about`, `terms-of-service`, `privacy-policy`
- Rich text content (markdown or simple HTML editor)
- Per-page SEO override

### 4. SEO Manager — `/workspace/settings/seo`
সব public পেইজের জন্য meta title, meta description, OG image:
- `/` (home), `/about`, `/shop`, `/courses`, `/terms-of-service`, `/privacy-policy`
- OG image upload (R2 bucket ইতিমধ্যে আছে)
- Head tag routes থেকে DB-এ শিফট করবো — SSR-safe loader দিয়ে fetch হবে যাতে crawlers ঠিকমতো পায়

Shop/course product & category-এর নিজস্ব meta ইতিমধ্যে DB-তে থাকে (products table এ metaTitle/metaDescription/ogImage আছে); ওই ফর্মগুলোতে ঠিকমতো wired আছে কিনা verify করে দরকার হলে ঠিক করবো।

## Technical Plan

```text
DB migrations (supabase migration):
  - site_settings           singleton row, JSONB (brand, contact, socials, footer)
  - homepage_content        singleton row, JSONB per section (hero, stats, courses,
                            shop, about, testimonials[], faq[], final_cta)
  - static_pages            slug PK, JSONB body + title
  - page_seo                path PK, meta_title, meta_description, og_image_url

RLS:
  - anon: SELECT on all four (public content)
  - authenticated with role admin/super_admin: full write via has_role()
  - GRANTs per public-schema rule

Server fns (src/lib/cms.functions.ts):
  - getHomepageContent, getSiteSettings, getStaticPage(slug), getPageSeo(path)
    → public read via server publishable client (SSR-safe, cached)
  - saveHomepageContent, saveSiteSettings, saveStaticPage, savePageSeo
    → requireSupabaseAuth + admin role check

Homepage refactor (src/routes/index.tsx):
  - loader: ensureQueryData for homepage_content + site_settings + page_seo('/')
  - head(): derive title/description/og from loaderData
  - component: read via useSuspenseQuery, render every string/link from data
  - fallback defaults inline so first-run before migration still works

Static page routes (about, terms, privacy):
  - loader fetches static_pages row by slug + page_seo
  - head() from loader data
  - render body

Shared SEO helper:
  - buildRouteHead(loaderData) — consistent title/desc/og/twitter/canonical

Footer:
  - Read site_settings; render Facebook/Instagram/WhatsApp icons only when URL set
  - Real brand SVGs (inline, currentColor) — Facebook 'f', Instagram camera outline, WhatsApp phone

Workspace admin UI (new routes under _authenticated/_internal.workspace.settings.*):
  - site.tsx           — brand + contact + socials + footer editor
  - homepage.tsx       — tabbed section editor with add/remove for testimonials & faq
  - pages.$slug.tsx    — static page + its SEO
  - seo.tsx            — table of all public paths with editable meta + OG upload
  - Sidebar nav updated in _internal.workspace.tsx

Image uploads for OG:
  - Reuse existing uploads.functions.ts + R2 helper
```

## Non-Goals (out of scope for this pass)

- WYSIWYG rich-text editor with images inline in static pages — will use a simple textarea with markdown (rendered via existing markdown pipeline if present, otherwise `react-markdown`). Can upgrade later.
- Multi-language content editing UI (Bangla stays as-is; single locale).
- Course/product SEO form changes — those already have fields; only fix if broken during verify.
- Reordering via drag-drop — will use up/down arrows for simplicity.

## Delivery order

1. Migration (tables, RLS, GRANTs, seed rows mirroring current hardcoded content so nothing visually changes on deploy)
2. Server functions (read + write)
3. Homepage refactor to consume DB
4. Footer social icons + contact
5. Static pages (about/terms/privacy) refactor
6. Workspace settings UI (site → homepage → pages → seo)
7. Wire SEO into every listed route's `head()`

চালিয়ে যাবো?