import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { getHomepageContent, saveHomepageContent } from "@/lib/cms.functions";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent } from "@/lib/cms-types";
import { Field, PageHeader, SaveButton, SectionCard, TextArea, TextInput } from "./FormPrimitives";
import { ImageUploadField } from "./ImageUploadField";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "hero", label: "Hero" },
  { id: "stats", label: "Stats" },
  { id: "courses", label: "Courses" },
  { id: "shop", label: "Shop" },
  { id: "about", label: "About" },
  { id: "testimonials", label: "Testimonials" },
  { id: "faq", label: "FAQ" },
  { id: "finalCta", label: "Final CTA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function HomepageEditor() {
  const load = useServerFn(getHomepageContent);
  const save = useServerFn(saveHomepageContent);
  const [c, setC] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [tab, setTab] = useState<TabId>("hero");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load(undefined as never).then((res) => res && setC(res as HomepageContent)).catch(() => {});
  }, [load]);

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: c });
      toast.success("হোমপেইজ সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
  }

  const setSection = <K extends keyof HomepageContent>(k: K, v: HomepageContent[K]) => setC((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CMS"
        title="Homepage"
        description="হোমপেইজের প্রতিটি সেকশনের টেক্সট, বাটন এবং লিংক এখান থেকে পরিবর্তন করুন।"
        action={<SaveButton saving={saving} onClick={onSave} />}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors",
              tab === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hero" && <HeroEditor value={c.hero} onChange={(v) => setSection("hero", v)} />}
      {tab === "stats" && <StatsEditor value={c.stats} onChange={(v) => setSection("stats", v)} />}
      {tab === "courses" && <SimpleSectionEditor value={c.courses} onChange={(v) => setSection("courses", v)} fields={coursesFields} title="Courses section" />}
      {tab === "shop" && <SimpleSectionEditor value={c.shop} onChange={(v) => setSection("shop", v)} fields={shopFields} title="Shop section" />}
      {tab === "about" && <AboutEditor value={c.about} onChange={(v) => setSection("about", v)} />}
      {tab === "testimonials" && <TestimonialsEditor value={c.testimonials} onChange={(v) => setSection("testimonials", v)} />}
      {tab === "faq" && <FaqEditor value={c.faq} onChange={(v) => setSection("faq", v)} />}
      {tab === "finalCta" && <SimpleSectionEditor value={c.finalCta} onChange={(v) => setSection("finalCta", v)} fields={finalCtaFields} title="Final CTA" />}

      <div className="flex justify-end">
        <SaveButton saving={saving} onClick={onSave} />
      </div>
    </div>
  );
}

/* ---------- Hero ---------- */

function HeroEditor({ value, onChange }: { value: HomepageContent["hero"]; onChange: (v: HomepageContent["hero"]) => void }) {
  const upd = (patch: Partial<HomepageContent["hero"]>) => onChange({ ...value, ...patch });
  const fc = value.featuredCard;
  return (
    <>
      <SectionCard title="Headline">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow left"><TextInput value={value.eyebrowLeft} onChange={(e) => upd({ eyebrowLeft: e.target.value })} /></Field>
          <Field label="Eyebrow right"><TextInput value={value.eyebrowRight} onChange={(e) => upd({ eyebrowRight: e.target.value })} /></Field>
        </div>
        <Field label="Title line 1"><TextInput value={value.titleLine1} onChange={(e) => upd({ titleLine1: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Line 2 prefix"><TextInput value={value.titleLine2Prefix} onChange={(e) => upd({ titleLine2Prefix: e.target.value })} /></Field>
          <Field label="Highlight word"><TextInput value={value.titleHighlight} onChange={(e) => upd({ titleHighlight: e.target.value })} /></Field>
          <Field label="Line 2 suffix"><TextInput value={value.titleLine2Suffix} onChange={(e) => upd({ titleLine2Suffix: e.target.value })} /></Field>
        </div>
        <Field label="Subtitle"><TextArea rows={3} value={value.subtitle} onChange={(e) => upd({ subtitle: e.target.value })} /></Field>
      </SectionCard>

      <SectionCard title="Call to action buttons">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Primary label"><TextInput value={value.ctaPrimaryLabel} onChange={(e) => upd({ ctaPrimaryLabel: e.target.value })} /></Field>
          <Field label="Primary link"><TextInput value={value.ctaPrimaryHref} onChange={(e) => upd({ ctaPrimaryHref: e.target.value })} /></Field>
          <Field label="Secondary label"><TextInput value={value.ctaSecondaryLabel} onChange={(e) => upd({ ctaSecondaryLabel: e.target.value })} /></Field>
          <Field label="Secondary link"><TextInput value={value.ctaSecondaryHref} onChange={(e) => upd({ ctaSecondaryHref: e.target.value })} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Social proof">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Student count"><TextInput value={value.socialProof.count} onChange={(e) => upd({ socialProof: { ...value.socialProof, count: e.target.value } })} /></Field>
          <Field label="Caption"><TextInput value={value.socialProof.caption} onChange={(e) => upd({ socialProof: { ...value.socialProof, caption: e.target.value } })} /></Field>
          <Field label="Rating"><TextInput value={value.socialProof.rating} onChange={(e) => upd({ socialProof: { ...value.socialProof, rating: e.target.value } })} /></Field>
        </div>
        <Field label="Avatar images" hint="হিরো সেকশনে দেখানো ছোট গোল ছবিগুলো। আপলোড করুন বা URL দিন।">
          <div className="space-y-3">
            {(value.socialProof.avatars ?? []).map((url, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <ImageUploadField
                    value={url}
                    onChange={(v) => {
                      const next = [...(value.socialProof.avatars ?? [])];
                      next[idx] = v;
                      upd({ socialProof: { ...value.socialProof, avatars: next } });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = (value.socialProof.avatars ?? []).filter((_, i) => i !== idx);
                    upd({ socialProof: { ...value.socialProof, avatars: next } });
                  }}
                  className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => upd({ socialProof: { ...value.socialProof, avatars: [...(value.socialProof.avatars ?? []), ""] } })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
            >
              <Plus className="size-3.5" /> Avatar যোগ করুন
            </button>
          </div>
        </Field>
      </SectionCard>

      <SectionCard title="Featured course card">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow"><TextInput value={fc.eyebrow} onChange={(e) => upd({ featuredCard: { ...fc, eyebrow: e.target.value } })} /></Field>
          <Field label="Live label"><TextInput value={fc.liveLabel} onChange={(e) => upd({ featuredCard: { ...fc, liveLabel: e.target.value } })} /></Field>
          <Field label="Title line 1"><TextInput value={fc.titleLine1} onChange={(e) => upd({ featuredCard: { ...fc, titleLine1: e.target.value } })} /></Field>
          <Field label="Title line 2"><TextInput value={fc.titleLine2} onChange={(e) => upd({ featuredCard: { ...fc, titleLine2: e.target.value } })} /></Field>
        </div>
        <Field label="Features (comma-separated)">
          <TextArea rows={2} value={fc.features.join(" | ")} onChange={(e) => upd({ featuredCard: { ...fc, features: e.target.value.split("|").map((x) => x.trim()).filter(Boolean) } })} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Price label"><TextInput value={fc.priceLabel} onChange={(e) => upd({ featuredCard: { ...fc, priceLabel: e.target.value } })} /></Field>
          <Field label="Price"><TextInput value={fc.price} onChange={(e) => upd({ featuredCard: { ...fc, price: e.target.value } })} /></Field>
          <Field label="Price suffix"><TextInput value={fc.priceSuffix} onChange={(e) => upd({ featuredCard: { ...fc, priceSuffix: e.target.value } })} /></Field>
        </div>
        <Field label="CTA link"><TextInput value={fc.ctaHref} onChange={(e) => upd({ featuredCard: { ...fc, ctaHref: e.target.value } })} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Badge"><TextInput value={fc.badge} onChange={(e) => upd({ featuredCard: { ...fc, badge: e.target.value } })} /></Field>
          <Field label="Floating title"><TextInput value={fc.floatingTitle} onChange={(e) => upd({ featuredCard: { ...fc, floatingTitle: e.target.value } })} /></Field>
          <Field label="Floating subtitle"><TextInput value={fc.floatingSubtitle} onChange={(e) => upd({ featuredCard: { ...fc, floatingSubtitle: e.target.value } })} /></Field>
        </div>
      </SectionCard>
    </>
  );
}

/* ---------- Stats ---------- */

function StatsEditor({ value, onChange }: { value: HomepageContent["stats"]; onChange: (v: HomepageContent["stats"]) => void }) {
  return (
    <SectionCard title="Stats bar">
      {value.map((s, i) => (
        <div key={i} className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2">
          <Field label={`Stat #${i + 1} value`}>
            <TextInput value={s.value} onChange={(e) => onChange(value.map((v, k) => (k === i ? { ...v, value: e.target.value } : v)))} />
          </Field>
          <Field label="Label">
            <TextInput value={s.label} onChange={(e) => onChange(value.map((v, k) => (k === i ? { ...v, label: e.target.value } : v)))} />
          </Field>
        </div>
      ))}
    </SectionCard>
  );
}

/* ---------- Simple sections (courses, shop, finalCta) ---------- */

type FieldSpec = { key: string; label: string; multiline?: boolean };

function SimpleSectionEditor<T extends Record<string, any>>({
  value,
  onChange,
  fields,
  title,
}: {
  value: T;
  onChange: (v: T) => void;
  fields: FieldSpec[];
  title: string;
}) {
  return (
    <SectionCard title={title}>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.multiline ? (
            <TextArea rows={3} value={value[f.key] ?? ""} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
          ) : (
            <TextInput value={value[f.key] ?? ""} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
          )}
        </Field>
      ))}
    </SectionCard>
  );
}

const coursesFields: FieldSpec[] = [
  { key: "index", label: "Index number" },
  { key: "eyebrow", label: "Eyebrow" },
  { key: "titleLine1", label: "Title line 1" },
  { key: "titleHighlight", label: "Highlight word" },
  { key: "titleLine2Suffix", label: "Line 2 suffix" },
  { key: "description", label: "Description", multiline: true },
  { key: "ctaLabel", label: "CTA label" },
  { key: "ctaHref", label: "CTA link" },
  { key: "emptyLabel", label: "Empty state text" },
];

const shopFields: FieldSpec[] = [
  { key: "index", label: "Index number" },
  { key: "eyebrow", label: "Eyebrow" },
  { key: "titleLine1", label: "Title line 1" },
  { key: "titleLine2Prefix", label: "Line 2 prefix" },
  { key: "titleHighlight", label: "Highlight word" },
  { key: "titleLine2Suffix", label: "Line 2 suffix" },
  { key: "description", label: "Description", multiline: true },
  { key: "ctaLabel", label: "CTA label" },
  { key: "ctaHref", label: "CTA link" },
];

const finalCtaFields: FieldSpec[] = [
  { key: "badge", label: "Badge" },
  { key: "titleLine1", label: "Title line 1" },
  { key: "titleLine2Prefix", label: "Line 2 prefix" },
  { key: "titleHighlight", label: "Highlight word" },
  { key: "titleLine2Suffix", label: "Line 2 suffix" },
  { key: "description", label: "Description", multiline: true },
  { key: "ctaPrimaryLabel", label: "Primary label" },
  { key: "ctaPrimaryHref", label: "Primary link" },
  { key: "ctaSecondaryLabel", label: "Secondary label" },
  { key: "ctaSecondaryHref", label: "Secondary link" },
];

/* ---------- About ---------- */

function AboutEditor({ value, onChange }: { value: HomepageContent["about"]; onChange: (v: HomepageContent["about"]) => void }) {
  const upd = (patch: Partial<HomepageContent["about"]>) => onChange({ ...value, ...patch });
  return (
    <>
      <SectionCard title="About section — heading">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Index"><TextInput value={value.index} onChange={(e) => upd({ index: e.target.value })} /></Field>
          <Field label="Eyebrow"><TextInput value={value.eyebrow} onChange={(e) => upd({ eyebrow: e.target.value })} /></Field>
        </div>
        <Field label="Title line 1"><TextInput value={value.titleLine1} onChange={(e) => upd({ titleLine1: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Line 2 prefix"><TextInput value={value.titleLine2Prefix} onChange={(e) => upd({ titleLine2Prefix: e.target.value })} /></Field>
          <Field label="Highlight word"><TextInput value={value.titleHighlight} onChange={(e) => upd({ titleHighlight: e.target.value })} /></Field>
          <Field label="Line 2 suffix"><TextInput value={value.titleLine2Suffix} onChange={(e) => upd({ titleLine2Suffix: e.target.value })} /></Field>
        </div>
        <Field label="Paragraph 1"><TextArea rows={3} value={value.paragraph1} onChange={(e) => upd({ paragraph1: e.target.value })} /></Field>
        <Field label="Paragraph 2"><TextArea rows={3} value={value.paragraph2} onChange={(e) => upd({ paragraph2: e.target.value })} /></Field>
        <Field label="Badge"><TextInput value={value.badge} onChange={(e) => upd({ badge: e.target.value })} /></Field>
      </SectionCard>

      <SectionCard title="Feature cards" description="Icon options: award, play, users, book, radio, star, sparkles">
        <ListEditor
          items={value.features}
          onChange={(items) => upd({ features: items })}
          empty={{ title: "", description: "", icon: "award" }}
          render={(item, set) => (
            <>
              <Field label="Title"><TextInput value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} /></Field>
              <Field label="Description"><TextArea rows={2} value={item.description} onChange={(e) => set({ ...item, description: e.target.value })} /></Field>
              <Field label="Icon"><TextInput value={item.icon} onChange={(e) => set({ ...item, icon: e.target.value })} /></Field>
            </>
          )}
        />
      </SectionCard>
    </>
  );
}

/* ---------- Testimonials ---------- */

function TestimonialsEditor({ value, onChange }: { value: HomepageContent["testimonials"]; onChange: (v: HomepageContent["testimonials"]) => void }) {
  const upd = (patch: Partial<HomepageContent["testimonials"]>) => onChange({ ...value, ...patch });
  return (
    <>
      <SectionCard title="Testimonials — heading">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Index"><TextInput value={value.index} onChange={(e) => upd({ index: e.target.value })} /></Field>
          <Field label="Eyebrow"><TextInput value={value.eyebrow} onChange={(e) => upd({ eyebrow: e.target.value })} /></Field>
        </div>
        <Field label="Title line 1"><TextInput value={value.titleLine1} onChange={(e) => upd({ titleLine1: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Highlight word"><TextInput value={value.titleHighlight} onChange={(e) => upd({ titleHighlight: e.target.value })} /></Field>
          <Field label="Line 2 suffix"><TextInput value={value.titleLine2Suffix} onChange={(e) => upd({ titleLine2Suffix: e.target.value })} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Reviews">
        <ListEditor
          items={value.items}
          onChange={(items) => upd({ items })}
          empty={{ name: "", role: "", text: "" }}
          render={(item, set) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name"><TextInput value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} /></Field>
                <Field label="Role"><TextInput value={item.role} onChange={(e) => set({ ...item, role: e.target.value })} /></Field>
              </div>
              <Field label="Testimonial text"><TextArea rows={3} value={item.text} onChange={(e) => set({ ...item, text: e.target.value })} /></Field>
            </>
          )}
        />
      </SectionCard>
    </>
  );
}

/* ---------- FAQ ---------- */

function FaqEditor({ value, onChange }: { value: HomepageContent["faq"]; onChange: (v: HomepageContent["faq"]) => void }) {
  const upd = (patch: Partial<HomepageContent["faq"]>) => onChange({ ...value, ...patch });
  return (
    <>
      <SectionCard title="FAQ — heading">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Index"><TextInput value={value.index} onChange={(e) => upd({ index: e.target.value })} /></Field>
          <Field label="Eyebrow"><TextInput value={value.eyebrow} onChange={(e) => upd({ eyebrow: e.target.value })} /></Field>
        </div>
        <Field label="Title line 1"><TextInput value={value.titleLine1} onChange={(e) => upd({ titleLine1: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Highlight word"><TextInput value={value.titleHighlight} onChange={(e) => upd({ titleHighlight: e.target.value })} /></Field>
          <Field label="Line 2 suffix"><TextInput value={value.titleLine2Suffix} onChange={(e) => upd({ titleLine2Suffix: e.target.value })} /></Field>
        </div>
        <Field label="Description"><TextArea rows={2} value={value.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
      </SectionCard>

      <SectionCard title="Questions">
        <ListEditor
          items={value.items}
          onChange={(items) => upd({ items })}
          empty={{ q: "", a: "" }}
          render={(item, set) => (
            <>
              <Field label="Question"><TextInput value={item.q} onChange={(e) => set({ ...item, q: e.target.value })} /></Field>
              <Field label="Answer"><TextArea rows={3} value={item.a} onChange={(e) => set({ ...item, a: e.target.value })} /></Field>
            </>
          )}
        />
      </SectionCard>
    </>
  );
}

/* ---------- Reusable list editor ---------- */

function ListEditor<T>({
  items,
  onChange,
  render,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (v: T) => void) => React.ReactNode;
  empty: T;
}) {
  function setAt(i: number, v: T) {
    onChange(items.map((it, k) => (k === i ? v : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, k) => k !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <IconBtn onClick={() => move(i, -1)} title="Move up"><ArrowUp className="size-3.5" /></IconBtn>
              <IconBtn onClick={() => move(i, 1)} title="Move down"><ArrowDown className="size-3.5" /></IconBtn>
              <IconBtn onClick={() => remove(i)} title="Delete" danger><Trash2 className="size-3.5" /></IconBtn>
            </div>
          </div>
          <div className="space-y-3">{render(item, (v) => setAt(i, v))}</div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...empty }])}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600"
      >
        <Plus className="size-3.5" /> Add item
      </button>
    </div>
  );
}

function IconBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100",
        danger && "hover:border-red-300 hover:bg-red-50 hover:text-red-600",
      )}
    >
      {children}
    </button>
  );
}
