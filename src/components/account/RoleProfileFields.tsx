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

export function RoleProfileFields({ role }: { role: AppRole }) {
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
      .catch((err) => toast.error("লোড ব্যর্থ: " + (err as Error).message))
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
    setForm((prev) => ({ ...prev, bank: { ...prev.bank, [k]: v } }));
  }

  async function handleCvPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("শুধুমাত্র PDF ফাইল আপলোড করা যাবে");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF সাইজ ১০ MB এর বেশি হতে পারবে না");
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
      toast.success("CV আপলোড হয়েছে");
    } catch (err) {
      toast.error("আপলোড ব্যর্থ: " + (err as Error).message);
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
      toast.error("URL তৈরি ব্যর্থ: " + (err as Error).message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        address: form.address.trim() || null,
        nid_number: form.nid_number.trim() || null,
        cv_r2_key: form.cv_r2_key.trim() || null,
        bank_details: form.bank && Object.values(form.bank).some(Boolean) ? form.bank : null,
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
      setSaved(form);
      setEditMode(false);
      toast.success("সেভ হয়েছে");
    } catch (err) {
      toast.error("সেভ ব্যর্থ: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  const locked = !editMode;

  return (
    <>
      {/* Role ID card */}
      <section className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
        <div className="grid size-10 place-items-center rounded-lg bg-brand text-brand-foreground">
          <IdCard className="size-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{ROLE_ID_LABEL[role]}</div>
          <div className="text-lg font-bold tracking-wider">#{profile?.display_id ?? "—"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {profile?.mfa_enrolled ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3" /> 2FA চালু
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              2FA সেটআপ প্রয়োজন
            </span>
          )}
        </div>
      </section>

      {/* Super Admin has no NID/CV/Bank fields */}
      {isSuperAdmin ? null : (
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4 text-brand" />
              {isInstructor ? "ইন্সট্রাক্টর তথ্য" : "এমপ্লয়ি তথ্য"}
              {locked && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Lock className="size-3" /> লকড
                </span>
              )}
            </h2>
            {locked ? (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20"
              >
                <Pencil className="size-3.5" /> এডিট
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setForm(saved);
                  setEditMode(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" /> বাতিল
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className={cn("grid gap-4 sm:grid-cols-2", locked && "opacity-90")}>
            <Field label="ঠিকানা *" className="sm:col-span-2">
              <textarea
                value={form.address}
                onChange={(e) => u("address", toEnglishText(e.target.value))}
                className={cn(inputClass, "min-h-[70px]")}
                placeholder="Present address"
                disabled={locked}
                required
              />
            </Field>

            <Field label="NID নম্বর *">
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
              <div className="flex items-center gap-2">
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
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  {uploading ? `আপলোড হচ্ছে... ${pct}%` : form.cv_r2_key ? "নতুন PDF" : "PDF আপলোড"}
                </button>
                {form.cv_r2_key && (
                  <button
                    type="button"
                    onClick={openCv}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    <ExternalLink className="size-3" /> দেখুন
                  </button>
                )}
              </div>
            </Field>

            <div className="sm:col-span-2 rounded-lg border border-border/70 bg-secondary/30 p-4">
              <div className="mb-3 text-xs font-semibold text-muted-foreground">পেআউট (Bank / MFS) *</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="মেথড">
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
                <Field label="একাউন্ট নাম">
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
                    <Field label="ব্যাংক নাম">
                      <input
                        type="text"
                        value={form.bank.bank_name ?? ""}
                        onChange={(e) => ub("bank_name", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="ব্রাঞ্চ">
                      <input
                        type="text"
                        value={form.bank.branch ?? ""}
                        onChange={(e) => ub("branch", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="একাউন্ট নম্বর">
                      <input
                        type="text"
                        value={form.bank.account_number ?? ""}
                        onChange={(e) => ub("account_number", toEnglishText(e.target.value))}
                        className={inputClass}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="রাউটিং নম্বর">
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
                  <Field label="MFS নম্বর">
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
                <Field label="বর্তমান কর্মস্থল">
                  <input
                    type="text"
                    value={form.workplace}
                    onChange={(e) => u("workplace", toEnglishText(e.target.value))}
                    className={inputClass}
                    disabled={locked}
                  />
                </Field>
                <Field label="বর্তমান জব রোল">
                  <input
                    type="text"
                    value={form.job_role}
                    onChange={(e) => u("job_role", toEnglishText(e.target.value))}
                    className={inputClass}
                    disabled={locked}
                  />
                </Field>
                <Field label="সাবজেক্টসমূহ (কমা দিয়ে আলাদা)" className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.subjects}
                    onChange={(e) => u("subjects", toEnglishText(e.target.value))}
                    className={inputClass}
                    placeholder="Physics, Math, ..."
                    disabled={locked}
                  />
                </Field>
                <Field label="ডিপার্টমেন্টসমূহ (কমা দিয়ে আলাদা)" className="sm:col-span-2">
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
                  className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  সেভ করুন
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
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:text-foreground/80";

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
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
