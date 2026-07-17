import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getStaticPage, saveStaticPage } from "@/lib/cms.functions";
import { EDITABLE_STATIC_PAGES, type StaticPage } from "@/lib/cms-types";
import { Field, PageHeader, SaveButton, SectionCard, TextArea, TextInput } from "./FormPrimitives";
import { cn } from "@/lib/utils";

export function StaticPagesEditor() {
  const load = useServerFn(getStaticPage);
  const save = useServerFn(saveStaticPage);
  const [slug, setSlug] = useState<string>(EDITABLE_STATIC_PAGES[0].slug);
  const [page, setPage] = useState<StaticPage>({ slug, title: "", eyebrow: "", body_markdown: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load({ data: { slug } })
      .then((res) => setPage((res as StaticPage) ?? { slug, title: "", eyebrow: "", body_markdown: "" }))
      .catch(() => setPage({ slug, title: "", eyebrow: "", body_markdown: "" }));
  }, [slug, load]);

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: page });
      toast.success("পেইজ সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CMS"
        title="Static pages"
        description="About, Terms এবং Privacy Policy পেজের কন্টেন্ট এখান থেকে পরিবর্তন করুন। Markdown সাপোর্ট করে (## for headings, **bold**, [link](url))।"
        action={<SaveButton saving={saving} onClick={onSave} />}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {EDITABLE_STATIC_PAGES.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setSlug(p.slug)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors",
              slug === p.slug ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <SectionCard title="Page content" description={`পাথ: ${EDITABLE_STATIC_PAGES.find((p) => p.slug === slug)?.route}`}>
        <Field label="Eyebrow / Category">
          <TextInput value={page.eyebrow} onChange={(e) => setPage({ ...page, eyebrow: e.target.value })} />
        </Field>
        <Field label="Page title (H1)">
          <TextInput value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} />
        </Field>
        <Field label="Body (Markdown)" hint="## for headings, **bold**, [link text](url), * list items">
          <TextArea rows={20} value={page.body_markdown} onChange={(e) => setPage({ ...page, body_markdown: e.target.value })} />
        </Field>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} onClick={onSave} />
      </div>
    </div>
  );
}
