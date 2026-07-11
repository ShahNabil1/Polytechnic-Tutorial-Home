import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Trash2,
  Save,
  Copy,
  Loader2,
  Lock,
  Eye,
  Code2,
  Pencil,
  X,
} from "lucide-react";
import {
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  setEmailTemplateEnabled,
} from "@/lib/email-templates.functions";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { TEMPLATE_CATEGORIES, categoryMeta } from "@/lib/template-categories";
import { cn } from "@/lib/utils";

const SAMPLE_VARS: Record<string, string> = {
  order_no: "PTH123",
  customer_name: "রহিম আহমেদ",
  amount: "1,250",
  receipt_url: "https://polytechnictutorial.com/checkout/success?order=PTH123",
  phone: "01700000000",
  ebook_list: `<div>
    <div style="padding:14px 0;border-bottom:1px solid #eef1f4;">
      <div style="font-weight:600;margin-bottom:6px;color:#0f172a;">Sample E-book Title</div>
      <a href="#" style="display:inline-block;padding:9px 16px;background:#0f766e;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">⬇ Download</a>
    </div>
  </div>`,
};

const SYSTEM_VARS: Record<string, string[]> = {
  ebook_delivery: ["order_no", "customer_name", "ebook_list"],
  order_confirmation: ["order_no", "customer_name", "amount", "receipt_url"],
};

const AUTO_KEYS = new Set(["order_confirmation", "ebook_delivery"]);
const DEFAULT_VARS = ["order_no", "customer_name", "amount", "receipt_url", "phone"];

function renderPreview(html: string, subject: string) {
  let outHtml = html;
  let outSubject = subject;
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi");
    outHtml = outHtml.replace(re, v);
    outSubject = outSubject.replace(re, v);
  }
  return { html: outHtml, subject: outSubject };
}

export function EmailTemplatesManager() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listEmailTemplates);
  const upsert = useServerFn(upsertEmailTemplate);
  const del = useServerFn(deleteEmailTemplate);
  const setEnabled = useServerFn(setEmailTemplateEnabled);

  const { data, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => fetchList(undefined as never),
  });
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId && !isNew && templates.length) setSelectedId(templates[0].id);
  }, [templates, selectedId, isNew]);
  const selected = useMemo(
    () => templates.find((t: any) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [tab, setTab] = useState<"code" | "preview">("preview");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setSubject(selected.subject);
      setBodyHtml(selected.body_html);
      setCategory(selected.category ?? "other");
      setIsNew(false);
      setIsEditing(false);
      setTab("preview");
    }
  }, [selected?.id]);

  const filteredTemplates = useMemo(
    () => (filter === "all" ? templates : templates.filter((t: any) => (t.category ?? "other") === filter)),
    [templates, filter],
  );

  const variables = useMemo<string[]>(() => {
    if (selected?.key && SYSTEM_VARS[selected.key]) return SYSTEM_VARS[selected.key];
    const raw = selected?.variables;
    const arr = Array.isArray(raw) ? (raw as unknown[]).map((x) => String(x)) : [];
    return arr.length ? arr : DEFAULT_VARS;
  }, [selected]);

  const preview = useMemo(() => renderPreview(bodyHtml, subject), [bodyHtml, subject]);

  async function save() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Name, subject and body are required");
      return;
    }
    setSaving(true);
    try {
      const res = await upsert({
        data: {
          id: selected?.id,
          name: name.trim(),
          subject: subject.trim(),
          body_html: bodyHtml,
          variables:
            selected?.key && SYSTEM_VARS[selected.key] ? SYSTEM_VARS[selected.key] : variables,
          category,
        },
      });
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      if (isNew && res.id) {
        setSelectedId(res.id);
        setIsNew(false);
      }
      setIsEditing(false);
      setTab("preview");
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function createNew() {
    setSelectedId(null);
    setIsNew(true);
    setIsEditing(true);
    setName("New email template");
    setSubject("");
    setCategory("campaign");
    setBodyHtml(
      `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;">Hello {{customer_name}},</h2>
  <p>Your message here...</p>
</div>`,
    );
    setTab("code");
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelEdit() {
    if (isNew) {
      setIsNew(false);
      if (templates[0]) setSelectedId(templates[0].id);
    } else if (selected) {
      setName(selected.name);
      setSubject(selected.subject);
      setBodyHtml(selected.body_html);
      setCategory(selected.category ?? "other");
    }
    setIsEditing(false);
    setTab("preview");
  }

  async function remove() {
    if (!selected || selected.is_system) return;
    const ok = await confirmDialog({
      title: "Delete template?",
      description: `"${selected.name}" delete করা হবে`,
      variant: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await del({ data: { id: selected.id } });
      toast.success("Template deleted");
      setSelectedId(null);
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  async function toggleEnabled(t: any, next: boolean) {
    try {
      await setEnabled({ data: { id: t.id, enabled: next } });
      qc.setQueryData(["email-templates"], (old: any) => ({
        templates: (old?.templates ?? []).map((x: any) => (x.id === t.id ? { ...x, enabled: next } : x)),
      }));
      toast.success(next ? "Auto-send enabled" : "Auto-send disabled");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  function copyVar(v: string) {
    const token = `{{${v}}}`;
    navigator.clipboard.writeText(token).then(() => toast.success(`Copied ${token}`));
  }

  const showEditor = selected || isNew;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <Mail className="size-6 text-brand" />
            Email Templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            E-book delivery, order confirmation, এবং custom CRM email templates এখান থেকে edit করো (Resend delivery)।
          </p>
        </div>
        <button
          onClick={createNew}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white transition-transform hover:bg-slate-800 active:scale-95"
        >
          <Plus className="size-4" /> New template
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="all">All categories ({templates.length})</option>
              {TEMPLATE_CATEGORIES.map((c) => {
                const n = templates.filter((t: any) => (t.category ?? "other") === c.value).length;
                return (
                  <option key={c.value} value={c.value}>
                    {c.label} ({n})
                  </option>
                );
              })}
            </select>
          </div>
          {isLoading && (
            <div className="p-4 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto size-4 animate-spin" />
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {filteredTemplates.map((t: any) => (
              <li key={t.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm",
                    selectedId === t.id && "bg-brand/5",
                  )}
                >
                  <button
                    onClick={() => {
                      setSelectedId(t.id);
                      setIsNew(false);
                    }}
                    className="min-w-0 flex-1 text-left hover:opacity-80"
                  >
                    <p className="truncate font-semibold text-slate-900">{t.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          categoryMeta(t.category).color,
                        )}
                      >
                        {categoryMeta(t.category).label}
                      </span>
                      {t.key && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          {t.key}
                        </span>
                      )}
                    </div>
                  </button>
                  {t.key && AUTO_KEYS.has(t.key) && (
                    <Switch
                      checked={t.enabled !== false}
                      onCheckedChange={(v) => toggleEnabled(t, v)}
                      title={t.enabled !== false ? "Auto-send on" : "Auto-send off"}
                    />
                  )}
                  {t.is_system && <Lock className="size-3.5 shrink-0 text-slate-400" />}
                </div>
              </li>
            ))}
            {!isLoading && templates.length === 0 && (
              <li className="p-4 text-center text-sm text-slate-500">No templates yet</li>
            )}
          </ul>
        </aside>

        <section ref={editorRef} className="rounded-xl border border-slate-200 bg-white p-4">
          {!showEditor ? (
            <p className="text-sm text-slate-500">Select a template or create a new one.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selected?.is_system ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Lock className="size-3.5" /> System template
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      {isNew ? "New template" : "Custom template"}
                    </span>
                  )}
                </div>
                {!isEditing && !isNew && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 transition-all hover:border-brand hover:text-brand active:scale-95"
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                )}
              </div>

              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Template name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing || selected?.is_system}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm disabled:bg-slate-50"
              />

              <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!isEditing}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm disabled:bg-slate-50"
                placeholder="আপনার অর্ডার কনফার্ম হয়েছে — {{order_no}}"
              />

              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Available variables (click to copy)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => copyVar(v)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 transition-colors hover:bg-brand/5 hover:text-brand"
                    >
                      <Copy className="size-3" />
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 border-b border-slate-200">
                <button
                  onClick={() => setTab("code")}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wider",
                    tab === "code"
                      ? "border-brand text-brand"
                      : "border-transparent text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Code2 className="size-3.5" /> HTML
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wider",
                    tab === "preview"
                      ? "border-brand text-brand"
                      : "border-transparent text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Eye className="size-3.5" /> Preview
                </button>
              </div>

              {tab === "code" ? (
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  disabled={!isEditing}
                  rows={18}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed disabled:bg-slate-100"
                />
              ) : (
                <div className="mt-2 rounded-lg border border-slate-200 bg-[#f6f8fa] p-4">
                  <div className="mb-2 text-xs text-slate-500">
                    <span className="font-bold uppercase tracking-wider">Subject:</span>{" "}
                    {preview.subject}
                  </div>
                  <iframe
                    title="Email preview"
                    srcDoc={`<!doctype html><html><body style="margin:0;padding:24px 8px;background:#f6f8fa;">${preview.html}</body></html>`}
                    className="h-[520px] w-full rounded-md border border-slate-200 bg-white"
                  />
                </div>
              )}

              {isEditing && (
                <div className="mt-4 flex animate-fade-in items-center justify-between">
                  <div>
                    {selected && !selected.is_system && (
                      <button
                        onClick={remove}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50 active:scale-95"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                    >
                      <X className="size-3.5" /> Cancel
                    </button>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      {saving ? "Saving…" : "Save template"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
