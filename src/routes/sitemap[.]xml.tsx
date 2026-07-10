import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://polytechnictutorial.com";

type Entry = {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  image?: { loc: string; title?: string; caption?: string };
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const client = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const staticEntries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/shop", changefreq: "daily", priority: "0.9" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms-of-service", changefreq: "yearly", priority: "0.3" },
        ];

        const [{ data: products }, { data: bundles }] = await Promise.all([
          client
            .from("products")
            .select("slug, updated_at, og_image_url, images, title, meta_description")
            .eq("is_active", true),
          client
            .from("product_bundles")
            .select("slug, updated_at, og_image_url, images, title, meta_description")
            .eq("is_active", true),
        ]);

        const productEntries: Entry[] = (products ?? []).map((p: any) => {
          const image =
            p.og_image_url || (Array.isArray(p.images) && p.images[0]?.url) || undefined;
          const e: Entry = {
            path: `/product/${p.slug}`,
            lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
            changefreq: "weekly",
            priority: "0.8",
          };
          if (image) e.image = { loc: image, title: p.title, caption: p.meta_description ?? undefined };
          return e;
        });

        const bundleEntries: Entry[] = (bundles ?? []).map((b: any) => {
          const image =
            b.og_image_url || (Array.isArray(b.images) && b.images[0]?.url) || undefined;
          const e: Entry = {
            path: `/bundle/${b.slug}`,
            lastmod: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
            changefreq: "weekly",
            priority: "0.85",
          };
          if (image) e.image = { loc: image, title: b.title, caption: b.meta_description ?? undefined };
          return e;
        });

        const all = [...staticEntries, ...productEntries, ...bundleEntries];

        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const urls = all.map((e) => {
          const lines = [
            `  <url>`,
            `    <loc>${esc(BASE_URL + e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
          ];
          if (e.image) {
            lines.push(`    <image:image>`);
            lines.push(`      <image:loc>${esc(e.image.loc)}</image:loc>`);
            if (e.image.title) lines.push(`      <image:title>${esc(e.image.title)}</image:title>`);
            if (e.image.caption) lines.push(`      <image:caption>${esc(e.image.caption)}</image:caption>`);
            lines.push(`    </image:image>`);
          }
          lines.push(`  </url>`);
          return lines.filter(Boolean).join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
