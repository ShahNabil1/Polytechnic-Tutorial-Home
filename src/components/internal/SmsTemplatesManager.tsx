import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MessageSquareText,
  Plus,
  Trash2,
  Save,
  Copy,
  Loader2,
  Lock,
  Pencil,
} from "lucide-react";
import {
  listSmsTemplates,
  upsertSmsTemplate,
  deleteSmsTemplate,
} from "@/lib/sms.functions";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

const SYSTEM_VARS: Record<string, string[]> = {
  order_confirm: ["name", "order_no", "amount", "receipt_url", "phone"],
  signup_otp: ["name", "otp"],
  reset_otp: ["name", "otp"],
};

const ALL_KNOWN_VARS = ["name", "order_no", "amount", "receipt_url", "phone", "otp"];

export function SmsTemplatesManager() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listSmsTemplates);
  const upsert = useServerFn(upsertSmsTemplate);
  const del = useServerFn(deleteSmsTemplate);

  const { data, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: () => fetchList(undefined as never),
  });
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && templates.length) setSelectedId(templates[0].id);
  }, [templates, selectedId]);
  const selected = useMemo(
    () => templates.find((t: any) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setBody(selected.body);
    } else {
      setName("");
      setBody("");
    }
  }, [selected?.id]);

  const variables = useMemo(() => {
    if (selected?.key && SYSTEM_VARS[selected.key]) return SYSTEM_VARS[selected.key];
    const arr = Array.isArray(selected?.variables) ? selected!.variables : ALL_KNOWN_VARS;
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
        },
      });
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["sms-templates"] });
      if (!selected?.id && res.id) setSelectedId(res.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function createNew() {
    setSelectedId(null);
    setName("New template");
    setBody("");
  }

  async function remove() {
    if (!selected || selected.is_system) return;
    const ok = await confirmDialog({
      title: "Delete template?",
      description: `"${selected.name}" delete করা হবে`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await del({ data: { id: selected.id } });
      toast.success("Template deleted");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  function copyVar(v: string) {
    const token = `{{${v}}}`;
    navigator.clipboard.writeText(token).then(() => toast.success(`Copied ${token}`));
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <MessageSquareText className="size-6 text-brand" />
            SMS Templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Order confirmation, OTP, reset password এবং custom templates এখান থেকে edit করো। Variables ব্যবহার করে personalized SMS পাঠাও।
          </p>
        </div>
        <button
          onClick={createNew}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Plus className="size-4" /> New template
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white">
          {isLoading && (
            <div className="p-4 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto size-4 animate-spin" />
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {templates.map((t: any) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50",
                    selectedId === t.id && "bg-brand/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{t.name}</p>
                    {t.key && (
                      <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {t.key}
                      </p>
                    )}
                  </div>
                  {t.is_system && <Lock className="mt-0.5 size-3.5 shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
            {!isLoading && templates.length === 0 && (
              <li className="p-4 text-center text-sm text-slate-500">No templates yet</li>
            )}
          </ul>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {selected === null && selectedId === null && name === "" ? (
            <p className="text-sm text-slate-500">Select a template or create a new one.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                {selected?.is_system ? (
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Lock className="size-3.5" /> System template — name locked
                  </div>
                ) : (
                  <Pencil className="size-3.5 text-slate-400" />
                )}
              </div>

              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Template name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={selected?.is_system}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
              />

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Available variables (click to copy)
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => copyVar(v)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:bg-brand/5 hover:text-brand"
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
                rows={8}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-sm"
                placeholder="প্রিয় {{name}}, ..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Use <code className="font-mono">{"{{newline}}"}</code> or a real line break for new lines.
                Length: {body.length}/1000
              </p>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={remove}
                  disabled={!selected || selected.is_system}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save template
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
