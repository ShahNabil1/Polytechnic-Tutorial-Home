import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getStaticPage, saveStaticPage } from "@/lib/cms.functions";
import { EDITABLE_STATIC_PAGES, type StaticPage } from "@/lib/cms-types";
import { Field, PageHeader, SaveButton, SectionCard, TextArea, TextInput } from "./FormPrimitives";
import { cn } from "@/lib/utils";

export function StaticPagesEditor() {
  const load = useServerFn(getStaticPage);
  const save = useServerFn(saveStaticPage);
  const qc = useQueryClient();
  const [slug, setSlug] = useState<string>(EDITABLE_STATIC_PAGES[0].slug);

  const { data } = useQuery({
    queryKey: ["admin", "cms", "page", slug],
    queryFn: () => load({ data: { slug } }),
    staleTime: 10 * 60_000,
  });

  const [page, setPage] = useState<StaticPage>({ slug, title: "", eyebrow: "", body_markdown: "" });
  useEffect(() => {
    setPage((data as StaticPage) ?? { slug, title: "", eyebrow: "", body_markdown: "" });
  }, [data, slug]);

  const mutation = useMutation({
    mutationFn: (payload: StaticPage) => save({ data: payload }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "cms", "page", vars.slug] });
      qc.invalidateQueries({ queryKey: ["static-page", vars.slug] });
      toast.success("পেইজ সেভ হয়েছে");
    },
    onError: (e: any) => toast.error(e?.message || "সেভ করা যায়নি"),
  });

  const onSave = () => mutation.mutate(page);
  const saving = mutation.isPending;

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
