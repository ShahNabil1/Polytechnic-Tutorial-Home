import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPageSeo, savePageSeo } from "@/lib/cms.functions";
import { KNOWN_SEO_PATHS, type PageSeo } from "@/lib/cms-types";
import { Field, PageHeader, SaveButton, SectionCard, TextArea, TextInput } from "./FormPrimitives";
import { ImageUploadField } from "./ImageUploadField";

type Row = PageSeo;

export function SeoEditor() {
  const load = useServerFn(listPageSeo);
  const save = useServerFn(savePageSeo);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load(undefined as never)
      .then((res) => {
        const byPath = new Map<string, Row>((res ?? []).map((r) => [r.path, r as Row]));
        const combined: Row[] = KNOWN_SEO_PATHS.map(({ path }) =>
          byPath.get(path) ?? { path, meta_title: "", meta_description: "", og_image_url: null },
        );
        // Also include any DB rows for paths not in KNOWN list
        for (const r of res ?? []) if (!combined.find((c) => c.path === r.path)) combined.push(r as Row);
        setRows(combined);
      })
      .catch(() => setRows(KNOWN_SEO_PATHS.map(({ path }) => ({ path, meta_title: "", meta_description: "", og_image_url: null }))));
  }, [load]);

  function setAt(i: number, v: Row) {
    setRows((prev) => prev.map((r, k) => (k === i ? v : r)));
  }

  async function onSave(row: Row) {
    setSaving(row.path);
    try {
      await save({
        data: {
          path: row.path,
          meta_title: row.meta_title,
          meta_description: row.meta_description,
          og_image_url: row.og_image_url || null,
        },
      });
      toast.success(`SEO সেভ হয়েছে (${row.path})`);
    } catch (e: any) {
      toast.error(e?.message || "সেভ করা যায়নি");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="SEO"
        title="Page metadata"
        description="প্রতিটি পাবলিক পেইজের meta title, meta description এবং OG image URL এখান থেকে সেট করুন। প্রোডাক্ট এবং কোর্সের নিজস্ব SEO ফিল্ড ওই পণ্য/কোর্স এডিটরে আছে।"
      />

      {rows.map((row, i) => {
        const known = KNOWN_SEO_PATHS.find((k) => k.path === row.path);
        return (
          <SectionCard key={row.path} title={known?.label || row.path} description={row.path}>
            <Field label="Meta title" hint="60 অক্ষরের কম রাখুন">
              <TextInput value={row.meta_title} onChange={(e) => setAt(i, { ...row, meta_title: e.target.value })} />
            </Field>
            <Field label="Meta description" hint="160 অক্ষরের কম রাখুন">
              <TextArea rows={3} value={row.meta_description} onChange={(e) => setAt(i, { ...row, meta_description: e.target.value })} />
            </Field>
            <Field label="OG image" hint="সরাসরি আপলোড করুন অথবা সম্পূর্ণ https URL দিন। ফাঁকা রাখলে ডিফল্ট সোশ্যাল প্রিভিউ হবে।">
              <ImageUploadField
                value={row.og_image_url ?? ""}
                onChange={(v) => setAt(i, { ...row, og_image_url: v || null })}
              />
            </Field>
            <div className="flex justify-end">
              <SaveButton saving={saving === row.path} onClick={() => onSave(row)} />
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
