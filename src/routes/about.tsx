import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { getStaticPage, getPageSeo } from "@/lib/cms.functions";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const [page, seo] = await Promise.all([
      getStaticPage({ data: { slug: "about" } }),
      getPageSeo({ data: { path: "/about" } }),
    ]);
    return { page, seo };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.seo?.meta_title || "আমাদের সম্পর্কে — Polytechnic Tutorial Home";
    const desc =
      loaderData?.seo?.meta_description ||
      "Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ছাত্র-ছাত্রীদের জন্য একটি ভরসাযোগ্য শিক্ষা প্ল্যাটফর্ম।";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: "https://polytechnictutorial.com/about" },
    ];
    if (loaderData?.seo?.og_image_url) {
      meta.push({ property: "og:image", content: loaderData.seo.og_image_url });
      meta.push({ name: "twitter:image", content: loaderData.seo.og_image_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: "https://polytechnictutorial.com/about" }],
    };
  },
  component: AboutPage,
});

function AboutPage() {
  const { page } = Route.useLoaderData();
  return (
    <div className="px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        {page?.eyebrow && (
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {page.eyebrow}
          </div>
        )}
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          {page?.title || "আমাদের সম্পর্কে"}
        </h1>
        <div className="prose prose-neutral mt-10 max-w-none text-base leading-relaxed text-muted-foreground prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground prose-a:text-brand">
          <ReactMarkdown>{page?.body_markdown || ""}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
