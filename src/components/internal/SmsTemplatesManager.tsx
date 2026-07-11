import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquareText, Plus, Trash2, Save, Copy, Loader2, Lock, Pencil, X } from "lucide-react";
import {
  listSmsTemplates,
  upsertSmsTemplate,
  deleteSmsTemplate,
  setSmsTemplateEnabled,
} from "@/lib/sms.functions";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { TEMPLATE_CATEGORIES, categoryMeta } from "@/lib/template-categories";
import { cn } from "@/lib/utils";

const SYSTEM_VARS: Record<string, string[]> = {
  order_confirm: ["name", "order_no", "amount", "receipt_url", "phone"],
  signup_otp: ["name", "otp"],
  reset_otp: ["name", "otp"],
};

const ALL_KNOWN_VARS = ["name", "order_no", "amount", "receipt_url", "phone", "otp"];

// System keys that represent auto-sent messages (toggle-able)
const AUTO_KEYS = new Set(["order_confirm"]);

export function SmsTemplatesManager() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listSmsTemplates);
  const upsert = useServerFn(upsertSmsTemplate);
  const del = useServerFn(deleteSmsTemplate);
  const setEnabled = useServerFn(setSmsTemplateEnabled);

  const { data, isLoading } = useQuery({
    queryKey: ["sms-templates"],
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
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setBody(selected.body);
      setCategory(selected.category ?? "other");
      setIsNew(false);
      setIsEditing(false);
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
    return arr.length ? arr : ALL_KNOWN_VARS;
  }, [selected]);

  async function save() {
    if (!name.trim() || !body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    setSaving(true);
    try {
      const res = await upsert({
        data: {
          id: selected?.id,
          name: name.trim(),
          body,
          variables: selected?.key && SYSTEM_VARS[selected.key] ? SYSTEM_VARS[selected.key] : variables,
          category,
        },
      });
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["sms-templates"] });
      if (isNew && res.id) {
        setSelectedId(res.id);
        setIsNew(false);
      }
      setIsEditing(false);
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
    setName("New template");
    setBody("");
    setCategory("campaign");
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelEdit() {
    if (isNew) {
      setIsNew(false);
      if (templates[0]) setSelectedId(templates[0].id);
    } else if (selected) {
      setName(selected.name);
      setBody(selected.body);
      setCategory(selected.category ?? "other");
    }
    setIsEditing(false);
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
      qc.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  async function toggleEnabled(t: any, next: boolean) {
    try {
      await setEnabled({ data: { id: t.id, enabled: next } });
      qc.setQueryData(["sms-templates"], (old: any) => ({
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
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <MessageSquareText className="size-6 text-brand" />
            SMS Templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Order confirmation, OTP, reset password এবং custom templates এখান থেকে edit করো।
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
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

              <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Message body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!isEditing}
                rows={8}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-sm disabled:bg-slate-50"
                placeholder="প্রিয় {{name}}, ..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Use <code className="font-mono">{"{{newline}}"}</code> or a real line break for new lines.
                Length: {body.length}/1000
              </p>

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
