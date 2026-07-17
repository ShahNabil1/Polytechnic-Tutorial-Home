
# Caching Plan — Upstash Redis + Cloudflare Edge + Browser

লক্ষ্য: Supabase DB এ read load কমানো, page load fast করা, strict invalidation (admin save → instant update)।

---

## Phase 1 — Foundation

**Secrets add করব:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**নতুন ফাইল: `src/lib/cache.server.ts`**
- `@upstash/redis` package install
- Helper functions:
  - `cacheGet<T>(key)` — Redis miss হলে null
  - `cacheSet(key, value, ttlSec)`
  - `cacheDel(key | key[])`
  - `cacheDelPrefix(prefix)` — SCAN + DEL, admin invalidation এর জন্য
  - `withCache<T>(key, ttl, loader)` — cache-aside wrapper
- Fail-open design: Redis down হলে সরাসরি DB fallback, throw করবে না

---

## Phase 2 — CMS + Site Settings Cache (Redis)

**Files edit:** `src/lib/cms.functions.ts`

Cache-wrapped read functions:
| Function | Cache key | TTL |
|---|---|---|
| `getSiteSettings` | `cms:site_settings` | 1 hour |
| `getHomepageContent` | `cms:homepage` | 1 hour |
| `getStaticPage(slug)` | `cms:page:{slug}` | 1 hour |
| `getPageSeo(path)` | `cms:seo:{path}` | 1 hour |

**Strict invalidation** — প্রতিটি `save*` function এ save success এর পর:
- `saveSiteSettings` → `cacheDel("cms:site_settings")`
- `saveHomepageContent` → `cacheDel("cms:homepage")`
- `saveStaticPage(slug)` → `cacheDel("cms:page:" + slug)`
- `savePageSeo(path)` → `cacheDel("cms:seo:" + path)`

Result: admin save করা মাত্রই next request এ fresh data।

---

## Phase 3 — HTTP Edge Cache Headers (Cloudflare)

**Files edit:** public route loaders / server functions যেগুলো anon traffic serve করে।

Cloudflare এ automatic edge cache — `s-maxage` respect করে। Redis এর আগের layer, free।

Target routes (public, anon-safe):
- `/` (homepage)
- `/shop`
- `/courses`
- `/about`, `/privacy-policy`, `/terms-of-service`
- `/sitemap.xml`
- `/product/$slug`, `/bundle/$slug`

Server function handler এ:
```ts
setResponseHeader(
  "Cache-Control",
  "public, s-maxage=300, stale-while-revalidate=3600"
);
```

**Purge on update:** admin save এ Cloudflare purge কল করব না (complexity বাড়ে) — বরং `s-maxage` short (5 min) রাখব, আর `Vary: Cookie` দিব যাতে logged-in users bypass করে। User-specific pages (checkout, sdash/*, workspace/*) এ cache header দিব না।

---

## Phase 4 — Product Catalog Cache (Redis)

**Files edit:** `src/lib/products.functions.ts`, `src/lib/bundles.functions.ts`, `src/lib/lms.functions.ts` (public reads)

| Function | Cache key | TTL |
|---|---|---|
| `listPublicProducts` | `products:list:public` | 10 min |
| `getProductBySlug(slug)` | `products:slug:{slug}` | 10 min |
| `listPublicBundles` | `bundles:list:public` | 10 min |
| `getBundleBySlug(slug)` | `bundles:slug:{slug}` | 10 min |
| `listPublicCategories` | `categories:public` | 1 hour |
| Public LMS structure (dept/sem/subject listings) | `lms:structure:*` | 30 min |

**Strict invalidation** — admin CRUD এ:
- Product save/delete → `cacheDelPrefix("products:")`
- Bundle save/delete → `cacheDelPrefix("bundles:")`
- Category change → `cacheDelPrefix("categories:")` + `cacheDelPrefix("products:")` (products carry category names)
- LMS structure change → `cacheDelPrefix("lms:")`

---

## Phase 5 — Browser cache tuning (low risk, quick)

**File edit:** `src/router.tsx`
- `defaultPreloadStaleTime: 0` → রাখব (Query controls freshness)
- Public data queries এ `staleTime: 5 * 60_000` add করব যেখানে relevant

**File edit:** `src/lib/upload-client.ts` / R2 upload
- R2 uploaded images এ `Cache-Control: public, max-age=31536000, immutable` set (filename hash-based, already unique)

---

## Technical notes

- **Redis package:** `@upstash/redis` (REST-based, Worker-compatible, no TCP)
- **Fail-open:** সব cache read try/catch এ, Redis error হলে DB fallback + console.warn
- **Key namespace:** `cms:*`, `products:*`, `bundles:*`, `categories:*`, `lms:*`
- **No cache for authenticated/user-specific data** — orders, cart, profiles Supabase এই থাকবে
- **SSR safe:** cache helpers server-only (`.server.ts`), route file loaders এ dynamic import করব দরকার হলে

---

## Out of scope (এই plan এ নেই, পরে করা যাবে)

- Rate limiting (`@upstash/ratelimit`) — আলাদা phase
- Service worker / offline shell
- Steadfast/SMS balance cache
- Coupon validation cache
- `has_role` per-user cache

---

## Rollout order

1. Phase 1 (foundation) — Upstash secrets + `cache.server.ts`
2. Phase 2 (CMS cache) — biggest immediate win, low risk
3. Phase 3 (edge headers) — even bigger win, zero Redis load
4. Phase 4 (product catalog) — after Phase 2 pattern proven
5. Phase 5 (browser tuning) — quick polish

প্রতি phase আলাদা করে verify করব — DB call count, page load time।
