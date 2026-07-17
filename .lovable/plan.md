# Premium UI/UX Refactor — Main Website

**Scope:** Only visual/UX layer of `/` (homepage), site header, site footer, and shared design tokens. All data fetching, routes, auth, cart, checkout, admin, and workspace logic remain **byte-for-byte identical**. No API/DB changes.

---

## 1. Design System (foundation)

Update `src/styles.css` with a custom editorial palette blended from your picks:

**Colors (light mode, primary)**
- Paper base: `#f5f3ee` (background), `#e8e4dd` (muted surface)
- Ink: `#2d2d2d` (foreground)
- Deep Emerald: `#064e3b` (primary), `#0d7a5f` (primary-glow)
- Indigo accent: `#1e1e5a` / `#4f46e5` (secondary / links)
- Gold: `#c9a84c` (accent), `#f0d78c` (accent-soft) — used sparingly for prestige highlights, dividers, numbers

**Dark mode**: ink `#0d0d0d` bg, `#f5f3ee` foreground, same emerald/indigo/gold accents shifted for contrast.

**Tokens added**
- `--gradient-editorial`: emerald → indigo diagonal
- `--gradient-gold`: gold → gold-soft
- `--shadow-editorial`: soft layered shadow with emerald tint
- `--shadow-gold`: subtle gold glow for CTAs
- Border radius scale kept, plus new `--radius-editorial: 2px` for sharp magazine blocks

**Typography** (loaded via `<link>` in `__root.tsx` head)
- Headings: **Syne** (700/800) — bold, distinctive display
- Body: **Plus Jakarta Sans** (400/500/600)
- Numeric/labels: Plus Jakarta with tight tracking, uppercase for eyebrow labels

---

## 2. Site Header (`site-header.tsx`)

Keep every existing link, drawer, cart, auth trigger. Refactor visuals only:
- Slimmer top strip with gold hairline divider
- Wordmark in Syne, tight tracking, small gold dot separator
- Nav links: uppercase micro-label + underline-on-hover reveal (emerald)
- Cart / auth buttons: pill icon buttons with subtle border, gold indicator dot for cart count
- Sticky header on scroll: shrinks, background frosted paper with border-bottom hairline
- Mobile: full-height drawer, editorial serif-adjacent headings

---

## 3. Homepage (`routes/index.tsx`) — Magazine Layout

All existing data queries (featured courses, bundles, products, departments) reused as-is. Only presentation swapped.

**Section order:**

1. **Editorial Hero (featured block)**
   - Split magazine cover: left = huge Syne headline + eyebrow label + emerald CTA + gold-underlined secondary link. Right = layered image / bento-mini with course thumbnail, floating stat cards (students count, courses count) with gold accents.
   - Issue-number style tag: "VOL. 01 · POLYTECHNIC EDITORIAL"

2. **Featured Grid (magazine)**
   - Asymmetric 3-column: one large feature card (7 cols) + two stacked small cards (5 cols).
   - Cards: paper background, thin ink border, category eyebrow, Syne title, meta row with gold divider.

3. **Departments strip**
   - Horizontal scroll / grid of department chips as editorial index entries: numbered `01 — Computer`, hover reveals emerald underline.

4. **Courses showcase**
   - 3-up card grid using existing `PublicCourseCard`, restyled: sharper corners, gold rating stars, price in Syne, "Enroll" button emerald with gold hover.

5. **Bundles block**
   - Full-width dark emerald band with gold headline, bundle cards in inverted palette (paper on emerald).

6. **Shop / Products preview**
   - Same product card component, restyled with editorial number labels and gold price tag.

7. **Trust / Stats band**
   - Big Syne numbers (students, courses, departments) with gold underline ticks and thin ink dividers.

8. **Editorial CTA footer band**
   - Full-width gradient (emerald → indigo), gold Syne headline, single primary CTA.

All sections wrapped in a consistent max-width container with generous whitespace, thin hairline dividers between sections, subtle grain texture overlay for print feel.

---

## 4. Site Footer (`site-footer.tsx`)

- Paper background with top gold hairline
- 4-column editorial grid: brand block (Syne wordmark + tagline), quick links, legal, contact
- Bottom bar: copyright + small gold dot separators, social icons as thin outlined circles
- Keeps every existing link

---

## 5. Motion (framer-motion, already available)

Restrained, premium:
- Hero headline: staggered word reveal on mount
- Section headings: fade-up on scroll (once)
- Cards: subtle lift + gold border glow on hover
- No parallax, no confetti, no rainbow gradients

---

## Technical notes

- Files touched:
  - `src/styles.css` (tokens + fonts reference)
  - `src/routes/__root.tsx` (font `<link>` tags only, keep everything else)
  - `src/routes/index.tsx` (JSX/markup refactor, same data hooks)
  - `src/components/site-header.tsx`
  - `src/components/site-footer.tsx`
  - `src/components/public-course-card.tsx` (visual only)
  - `src/components/product-card.tsx` (visual only)
- No changes to: routes list, loaders, server functions, auth, cart, checkout, admin, workspace, DB, migrations, edge functions.
- No new dependencies (framer-motion already in project).
- Both light + dark modes fully themed.

---

Approve to build.
