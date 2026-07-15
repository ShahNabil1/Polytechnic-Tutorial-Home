import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  IdCard,
  Pencil,
  Lock,
  CheckCircle2,
  X,
  FileText,
  ShieldCheck,
  Upload,
  ExternalLink,
} from "lucide-react";
import {
  getMyInternalProfile,
  updateMyInternalProfile,
  getInternalDocSignedUrl,
  type InternalProfile,
  type BankDetails,
} from "@/lib/internal-profile.functions";
import type { AppRole } from "@/lib/roles.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import { toEnglishText } from "@/lib/input-filter";
import { cn } from "@/lib/utils";

type FormState = {
  address: string;
  nid_number: string;
  cv_r2_key: string;
  bank: BankDetails;
  workplace: string;
  job_role: string;
  subjects: string;
  departments: string;
};

const EMPTY: FormState = {
  address: "",
  nid_number: "",
  cv_r2_key: "",
  bank: { method: "bank" },
  workplace: "",
  job_role: "",
  subjects: "",
  departments: "",
};

const ROLE_ID_LABEL: Record<AppRole, string> = {
  student: "Student ID",
  employee: "Employee ID",
  instructor: "Instructor ID",
  super_admin: "Admin ID",
};

export function RoleProfileFieldsEN({ role }: { role: AppRole }) {
  const isInstructor = role === "instructor";
  const isSuperAdmin = role === "super_admin";
  const load = useServerFn(getMyInternalProfile);
  const save = useServerFn(updateMyInternalProfile);
  const signUrl = useServerFn(getInternalDocSignedUrl);

  const [profile, setProfile] = useState<InternalProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(undefined as never)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        const f: FormState = {
          address: p?.address ?? "",
          nid_number: p?.nid_number ?? "",
          cv_r2_key: p?.cv_r2_key ?? "",
          bank: (p?.bank_details as BankDetails) ?? { method: "bank" },
          workplace: p?.workplace ?? "",
          job_role: p?.job_role ?? "",
          subjects: (p?.subjects ?? []).join(", "),
          departments: (p?.departments ?? []).join(", "),
        };
        setForm(f);
        setSaved(f);
        setEditMode(!p?.address);
      })
      .catch((err) => toast.error("Failed to load: " + (err as Error).message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function u<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function ub<K extends keyof BankDetails>(k: K, v: BankDetails[K]) {
    setForm((prev) => {
      // Switching payout method must clear fields that don't belong to the new method
      // so ghost values (e.g. an old bank_name typed before switching to bKash) never get saved.
      if (k === "method") {
        const nextMethod = v as BankDetails["method"];
        return {
          ...prev,
          bank: { method: nextMethod, account_name: prev.bank.account_name },
        };
      }
      return { ...prev, bank: { ...prev.bank, [k]: v } };
    });
  }

  async function handleCvPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF size must be under 10 MB");
      return;
    }
    setUploading(true);
    setPct(0);
    try {
      const { key } = await uploadFileToR2(file, {
        folder: "internal-docs",
        compress: false,
        onProgress: setPct,
      });
      u("cv_r2_key", key);
      toast.success("CV uploaded");
    } catch (err) {
      toast.error("Upload failed: " + (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openCv() {
    if (!form.cv_r2_key) return;
    try {
      const { url } = await signUrl({ data: { key: form.cv_r2_key } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error("Failed to generate URL: " + (err as Error).message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Only keep fields relevant to the currently-selected payout method so
      // switching from bank → MFS (or vice versa) does not persist stale fields.
      const method = form.bank.method ?? "bank";
      const cleanBank: BankDetails = { method };
      if (form.bank.account_name?.trim()) cleanBank.account_name = form.bank.account_name.trim();
      if (method === "bank") {
        if (form.bank.bank_name?.trim()) cleanBank.bank_name = form.bank.bank_name.trim();
        if (form.bank.branch?.trim()) cleanBank.branch = form.bank.branch.trim();
        if (form.bank.account_number?.trim()) cleanBank.account_number = form.bank.account_number.trim();
        if (form.bank.routing?.trim()) cleanBank.routing = form.bank.routing.trim();
      } else {
        if (form.bank.mfs_number?.trim()) cleanBank.mfs_number = form.bank.mfs_number.trim();
      }
      const hasBank = Object.keys(cleanBank).length > 1; // method + at least one field

      const payload = {
        address: form.address.trim() || null,
        nid_number: form.nid_number.trim() || null,
        cv_r2_key: form.cv_r2_key.trim() || null,
        bank_details: hasBank ? cleanBank : null,
        workplace: isInstructor ? form.workplace.trim() || null : null,
        job_role: isInstructor ? form.job_role.trim() || null : null,
        subjects: isInstructor
          ? form.subjects.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        departments: isInstructor
          ? form.departments.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await save({ data: payload });
      const nextForm = { ...form, bank: cleanBank };
      setForm(nextForm);
      setSaved(nextForm);
      setEditMode(false);
      toast.success("Saved");
    } catch (err) {
      toast.error("Save failed: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </section>
    );
  }

  const locked = !editMode;

  return (
    <>
      {/* Role ID card */}
      <section className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
        <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
          <IdCard className="size-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {ROLE_ID_LABEL[role]}
          </div>
          <div className="font-display text-xl font-bold tracking-wider text-slate-900">
            #{profile?.display_id ?? "—"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {profile?.mfa_enrolled ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <ShieldCheck className="size-3" /> 2FA ON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              2FA Required
            </span>
          )}
        </div>
      </section>

      {isSuperAdmin ? null : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <FileText className="size-4 text-indigo-600" />
              {isInstructor ? "Instructor Details" : "Employee Details"}
              {locked && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <Lock className="size-3" /> Locked
                </span>
              )}
            </h2>
            {locked ? (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setForm(saved);
                  setEditMode(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="size-3.5" /> Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className={cn("grid gap-4 sm:grid-cols-2", locked && "opacity-90")}>
            <Field label="Address *" className="sm:col-span-2">
              <textarea
                value={form.address}
                onChange={(e) => u("address", toEnglishText(e.target.value))}
                className={cn(inputClass, "min-h-[70px]")}
                placeholder="Present address"
                disabled={locked}
                required
              />
            </Field>

            <Field label="NID Number *">
              <input
                type="text"
                value={form.nid_number}
                onChange={(e) => u("nid_number", toEnglishText(e.target.value))}
                className={inputClass}
                placeholder="10 / 13 / 17-digit"
                disabled={locked}
                required
              />
            </Field>

            <Field label="CV (PDF) *">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleCvPick}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={locked || uploading}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  {uploading ? `Uploading... ${pct}%` : form.cv_r2_key ? "Replace PDF" : "Upload PDF"}
                </button>
                {form.cv_r2_key && (
                  <button
                    type="button"
                    onClick={openCv}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="size-3" /> View
                  </button>
                )}
              </div>
            </Field>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Payout (Bank / MFS) *
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Method">
                  <select
                    value={form.bank.method ?? "bank"}
                    onChange={(e) => ub("method", e.target.value as BankDetails["method"])}
                    className={inputClass}
                    disabled={locked}
                  >
                    <option value="bank">Bank</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="upay">Upay</option>
                  </select>
                </Field>
                <Field label="Account Name">
                  <input
                    type="text"
                    value={form.bank.account_name ?? ""}
                    onChange={(e) => ub("account_name", toEnglishText(e.target.value))}
                    className={inputClass}
                    disabled={locked}
                  />
                </Field>
                {form.bank.method === "bank" ? (
                  <>
                    <Field label="Bank Name">
                      <input
                        type="text"
                        value={form.bank.bank_name ?? ""}
                        onChange={(e) => ub("bank_name", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Branch">
                      <input
                        type="text"
                        value={form.bank.branch ?? ""}
                        onChange={(e) => ub("branch", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Account Number">
                      <input
                        type="text"
                        value={form.bank.account_number ?? ""}
                        onChange={(e) => ub("account_number", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Routing Number">
                      <input
                        type="text"
                        value={form.bank.routing ?? ""}
                        onChange={(e) => ub("routing", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                  </>
                ) : (
                  <Field label="MFS Number">
                    <input
                      type="text"
                      value={form.bank.mfs_number ?? ""}
                      onChange={(e) => ub("mfs_number", toEnglishText(e.target.value))}
                      className={inputClass}
                      disabled={locked}
                      placeholder="01XXXXXXXXX"
                    />
                  </Field>
                )}
              </div>
            </div>

            {isInstructor && (
              <>
                <Field label="Current Workplace">
                  <input
                    type="text"
                    value={form.workplace}
                    onChange={(e) => u("workplace", toEnglishText(e.target.value))}
                    className={inputClass}
                    disabled={locked}
                  />
                </Field>
                <Field label="Current Job Role">
                  <input
                    type="text"
                    value={form.job_role}
                    onChange={(e) => u("job_role", toEnglishText(e.target.value))}
                    className={inputClass}
                    disabled={locked}
                  />
                </Field>
                <Field label="Subjects (comma separated)" className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.subjects}
                    onChange={(e) => u("subjects", toEnglishText(e.target.value))}
                    className={inputClass}
                    placeholder="Physics, Math, ..."
                    disabled={locked}
                  />
                </Field>
                <Field label="Departments (comma separated)" className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.departments}
                    onChange={(e) => u("departments", toEnglishText(e.target.value))}
                    className={inputClass}
                    placeholder="Computer, Civil, ..."
                    disabled={locked}
                  />
                </Field>
              </>
            )}

            {!locked && (
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </section>
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
