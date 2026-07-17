import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_HOMEPAGE_CONTENT,
  DEFAULT_SITE_SETTINGS,
  mergeWithDefaults,
  type HomepageContent,
  type PageSeo,
  type SiteSettings,
  type StaticPage,
} from "./cms-types";

function serverPublic() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function ensureCanManage(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (isAdmin === true) return;
  const { data: canManage } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_users",
  });
  if (canManage !== true) throw new Error("Forbidden");
}

// ---------- Public reads ----------

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublic();
  const { data } = await sb.from("site_settings").select("*").eq("id", "global").maybeSingle();
  const merged: SiteSettings = {
    brand: mergeWithDefaults(DEFAULT_SITE_SETTINGS.brand, (data as any)?.brand),
    contact: mergeWithDefaults(DEFAULT_SITE_SETTINGS.contact, (data as any)?.contact),
    socials: mergeWithDefaults(DEFAULT_SITE_SETTINGS.socials, (data as any)?.socials),
    footer: mergeWithDefaults(DEFAULT_SITE_SETTINGS.footer, (data as any)?.footer),
  };
  return merged;
});

export const getHomepageContent = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublic();
  const { data } = await sb.from("homepage_content").select("content").eq("id", "global").maybeSingle();
  return mergeWithDefaults<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT, (data as any)?.content);
});

export const getStaticPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: row } = await sb.from("static_pages").select("*").eq("slug", data.slug).maybeSingle();
    return (row ?? null) as StaticPage | null;
  });

export const getPageSeo = createServerFn({ method: "GET" })
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: row } = await sb.from("page_seo").select("*").eq("path", data.path).maybeSingle();
    return (row ?? null) as PageSeo | null;
  });

export const listPageSeo = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublic();
  const { data } = await sb.from("page_seo").select("*").order("path");
  return (data ?? []) as PageSeo[];
});

// Combined loader for homepage: content + seo + site + static-page-for-slug (optional)
export const getHomepageBundle = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublic();
  const [homepage, site, seo] = await Promise.all([
    sb.from("homepage_content").select("content").eq("id", "global").maybeSingle(),
    sb.from("site_settings").select("*").eq("id", "global").maybeSingle(),
    sb.from("page_seo").select("*").eq("path", "/").maybeSingle(),
  ]);
  return {
    homepage: mergeWithDefaults<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT, (homepage.data as any)?.content),
    site: {
      brand: mergeWithDefaults(DEFAULT_SITE_SETTINGS.brand, (site.data as any)?.brand),
      contact: mergeWithDefaults(DEFAULT_SITE_SETTINGS.contact, (site.data as any)?.contact),
      socials: mergeWithDefaults(DEFAULT_SITE_SETTINGS.socials, (site.data as any)?.socials),
      footer: mergeWithDefaults(DEFAULT_SITE_SETTINGS.footer, (site.data as any)?.footer),
    } as SiteSettings,
    seo: (seo.data ?? null) as PageSeo | null,
  };
});

// ---------- Admin writes ----------

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SiteSettings) => d)
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("site_settings").upsert({
      id: "global",
      brand: data.brand,
      contact: data.contact,
      socials: data.socials,
      footer: data.footer,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveHomepageContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: HomepageContent) => d)
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase
      .from("homepage_content")
      .upsert({ id: "global", content: data as any });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveStaticPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; title: string; eyebrow: string; body_markdown: string }) =>
    z
      .object({
        slug: z.string().min(1),
        title: z.string().default(""),
        eyebrow: z.string().default(""),
        body_markdown: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("static_pages").upsert({
      slug: data.slug,
      title: data.title,
      eyebrow: data.eyebrow,
      body_markdown: data.body_markdown,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePageSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; meta_title: string; meta_description: string; og_image_url?: string | null }) =>
    z
      .object({
        path: z.string().min(1),
        meta_title: z.string().default(""),
        meta_description: z.string().default(""),
        og_image_url: z.string().url().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("page_seo").upsert({
      path: data.path,
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      og_image_url: data.og_image_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStaticPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManage(context);
    const { data, error } = await context.supabase.from("static_pages").select("*").order("slug");
    if (error) throw new Error(error.message);
    return (data ?? []) as StaticPage[];
  });
