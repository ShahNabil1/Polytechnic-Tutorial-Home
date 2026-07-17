import { createFileRoute, Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { Shield, FileText } from "lucide-react";
import { getStaticPage, getPageSeo } from "@/lib/cms.functions";

export const Route = createFileRoute("/privacy-policy")({
  loader: async () => {
    const [page, seo] = await Promise.all([
      getStaticPage({ data: { slug: "privacy-policy" } }),
      getPageSeo({ data: { path: "/privacy-policy" } }),
    ]);
    return { page, seo };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.seo?.meta_title || "Privacy Policy — Polytechnic Tutorial Home";
    const desc =
      loaderData?.seo?.meta_description || "Polytechnic Tutorial Home-র ব্যবহারকারী তথ্যের গোপনীয়তা নীতিমালা।";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: "https://polytechnictutorial.com/privacy-policy" },
    ];
    if (loaderData?.seo?.og_image_url) {
      meta.push({ property: "og:image", content: loaderData.seo.og_image_url });
      meta.push({ name: "twitter:image", content: loaderData.seo.og_image_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: "https://polytechnictutorial.com/privacy-policy" }],
    };
  },
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { page } = Route.useLoaderData();
  return (
    <div className="px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Shield className="size-5" />
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {page?.eyebrow || "Privacy"}
          </div>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          {page?.title || "Privacy Policy"}
        </h1>
        <div className="prose prose-neutral mt-10 max-w-none text-base leading-relaxed text-muted-foreground prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground prose-a:text-brand">
          <ReactMarkdown>{page?.body_markdown || ""}</ReactMarkdown>
        </div>
        <div className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" />
          <span>সম্পর্কিত:</span>
          <Link to="/terms-of-service" className="text-brand hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
