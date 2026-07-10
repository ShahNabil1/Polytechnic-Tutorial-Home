import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  User as UserIcon,
  Upload,
  IdCard,
  Pencil,
  Lock,
  CheckCircle2,
  X,
} from "lucide-react";
import { PasskeysCard } from "@/components/account/PasskeysCard";
import { LinkedAccountsCard } from "@/components/account/LinkedAccountsCard";
import { PasswordCard } from "@/components/account/PasswordCard";
import { SessionsCard } from "@/components/account/SessionsCard";
import { ReauthDialogHost } from "@/components/account/ReauthDialog";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { RoleProfileFields } from "@/components/account/RoleProfileFields";
import { uploadFileToR2 } from "@/lib/upload-client";
import { toEnglishText } from "@/lib/input-filter";
import {
  SEMESTER_OPTIONS,
  DEPARTMENT_OPTIONS,
  getMissingProfileFields,
  type ProfileRow,
} from "@/lib/profile";
import type { AppRole } from "@/lib/roles.functions";
import { cn } from "@/lib/utils";

type FormState = {
  full_name: string;
  avatar_url: string;
  institute_name: string;
  department_name: string;
  current_semester: string;
  board_roll: string;
  registration_no: string;
};

const EMPTY_FORM: FormState = {
  full_name: "",
  avatar_url: "",
  institute_name: "",
  department_name: "",
  current_semester: "",
  board_roll: "",
  registration_no: "",
};

const ROLE_LABEL: Record<AppRole, string> = {
  student: "স্টুডেন্ট",
  employee: "এমপ্লয়ি",
  instructor: "ইন্সট্রাক্টর",
  super_admin: "সুপার অ্যাডমিন",
};

export function ProfilePage({ role }: { role: AppRole }) {
  const isStudent = role === "student";
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      if (data) {
        const next: FormState = {
          full_name: data.full_name ?? "",
          avatar_url: data.avatar_url ?? "",
          institute_name: (data as { institute_name?: string | null }).institute_name ?? "",
          department_name: (data as { department_name?: string | null }).department_name ?? "",
          current_semester: (data as { current_semester?: string | null }).current_semester ?? "",
          board_roll: (data as { board_roll?: string | null }).board_roll ?? "",
          registration_no: (data as { registration_no?: string | null }).registration_no ?? "",
        };
        setForm(next);
        setSavedForm(next);
        setStudentId((data as { student_id?: number | null }).student_id ?? null);
        if (isStudent) {
          const missing = getMissingProfileFields(data);
          setEditMode(missing.length > 0);
        } else {
          setEditMode(!data.full_name);
        }
      } else {
        setEditMode(true);
      }
      setLoadError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isStudent]);

  const isComplete = useMemo(() => {
    if (!isStudent) return !!form.full_name.trim();
    return (
      getMissingProfileFields({
        full_name: form.full_name || null,
        institute_name: form.institute_name || null,
        department_name: form.department_name || null,
        current_semester: (form.current_semester || null) as ProfileRow["current_semester"],
        board_roll: form.board_roll || null,
        registration_no: form.registration_no || null,
      } as Partial<ProfileRow>).length === 0
    );
  }, [form, isStudent]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("শুধুমাত্র ছবি আপলোড করা যাবে");
      return;
    }
    setPickedFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCropped(blob: Blob) {
    setPickedFile(null);
    setUploading(true);
    setUploadPct(0);
    try {
      const croppedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url } = await uploadFileToR2(croppedFile, {
        folder: "avatars",
        onProgress: (p) => setUploadPct(p),
      });
      updateField("avatar_url", url);
      toast.success("ছবি আপলোড হয়েছে");
    } catch (err) {
      toast.error("আপলোড ব্যর্থ: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const nextForm: FormState = {
      full_name: form.full_name.trim(),
      avatar_url: form.avatar_url.trim(),
      institute_name: form.institute_name.trim(),
      department_name: form.department_name.trim(),
      current_semester: form.current_semester,
      board_roll: form.board_roll.trim(),
      registration_no: form.registration_no.trim(),
    };
    const payload = isStudent
      ? ({
          full_name: nextForm.full_name || null,
          avatar_url: nextForm.avatar_url || null,
          institute_name: nextForm.institute_name || null,
          department_name: nextForm.department_name || null,
          current_semester: nextForm.current_semester || null,
          board_roll: nextForm.board_roll || null,
          registration_no: nextForm.registration_no || null,
        } as never)
      : ({
          full_name: nextForm.full_name || null,
          avatar_url: nextForm.avatar_url || null,
        } as never);
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("সেভ করা যায়নি: " + error.message);
      return;
    }
    setForm(nextForm);
    setSavedForm(nextForm);
    toast.success("প্রোফাইল সেভ হয়েছে");
    if (isComplete) setEditMode(false);
  }

  function handleCancelEdit() {
    setForm(savedForm);
    setEditMode(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        প্রোফাইল লোড করা যায়নি: {loadError}
      </div>
    );
  }

  const locked = !editMode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">প্রোফাইল ও সিকিউরিটি</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ব্যক্তিগত তথ্য, লগইন মেথড ও একটিভ সেশন ম্যানেজ করুন। ({ROLE_LABEL[role]})
        </p>
      </div>

      {isStudent && studentId !== null && (
        <section className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <div className="grid size-10 place-items-center rounded-lg bg-brand text-brand-foreground">
            <IdCard className="size-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">আপনার স্টুডেন্ট আইডি</div>
            <div className="text-lg font-bold tracking-wider">#{studentId}</div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <UserIcon className="size-4 text-brand" />
            ব্যক্তিগত তথ্য
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
            isComplete && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" /> বাতিল
              </button>
            )
          )}
        </div>

        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {form.avatar_url ? (
            <img
              src={form.avatar_url}
              alt=""
              className="size-24 rounded-full object-cover ring-2 ring-brand/30"
            />
          ) : (
            <div className="grid size-24 place-items-center rounded-full bg-secondary">
              <UserIcon className="size-9 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <div className="text-base font-semibold">{form.full_name || "নাম যোগ করুন"}</div>
            <div className="text-xs text-muted-foreground">
              {user?.phone || user?.email || user?.id}
            </div>
            {!locked && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFilePick}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {uploading ? `আপলোড হচ্ছে... ${uploadPct}%` : "ছবি পরিবর্তন"}
                </button>
                {form.avatar_url && (
                  <button
                    type="button"
                    onClick={() => updateField("avatar_url", "")}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    সরান
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className={cn("grid gap-4 sm:grid-cols-2", locked && "opacity-90")}
        >
          <Field label="পূর্ণ নাম *">
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateField("full_name", toEnglishText(e.target.value))}
              className={inputClass}
              placeholder="আপনার নাম"
              required
              disabled={locked}
            />
          </Field>

          {isStudent && (
            <>
              <Field label="ইনস্টিটিউট নাম *">
                <input
                  type="text"
                  value={form.institute_name}
                  onChange={(e) => updateField("institute_name", toEnglishText(e.target.value))}
                  className={inputClass}
                  placeholder="যেমনঃ Dhaka Polytechnic Institute"
                  required
                  disabled={locked}
                />
              </Field>

              <Field label="ডিপার্টমেন্ট *">
                <select
                  value={form.department_name}
                  onChange={(e) => updateField("department_name", e.target.value)}
                  className={inputClass}
                  required
                  disabled={locked}
                >
                  <option value="">— নির্বাচন করুন —</option>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="বর্তমান সেমিস্টার *">
                <select
                  value={form.current_semester}
                  onChange={(e) => updateField("current_semester", e.target.value)}
                  className={inputClass}
                  required
                  disabled={locked}
                >
                  <option value="">— নির্বাচন করুন —</option>
                  {SEMESTER_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="বোর্ড রোল *">
                <input
                  type="text"
                  value={form.board_roll}
                  onChange={(e) => updateField("board_roll", toEnglishText(e.target.value))}
                  className={inputClass}
                  placeholder="যেমনঃ 123456"
                  required
                  disabled={locked}
                />
              </Field>

              <Field label="রেজিস্ট্রেশন নম্বর *">
                <input
                  type="text"
                  value={form.registration_no}
                  onChange={(e) => updateField("registration_no", toEnglishText(e.target.value))}
                  className={inputClass}
                  placeholder="যেমনঃ 1234567890"
                  required
                  disabled={locked}
                />
              </Field>
            </>
          )}

          {!locked && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                সেভ করুন
              </button>
              {!isComplete && isStudent && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  সব ম্যান্ডেটরি ফিল্ড পূরণ না হলে লক হবে না
                </span>
              )}
            </div>
          )}
        </form>
      </section>

      {!isStudent && <RoleProfileFields role={role} />}

      <LinkedAccountsCard />
      <PasswordCard />
      <PasskeysCard />
      <SessionsCard />
      <ReauthDialogHost />

      {pickedFile && (
        <ImageCropperDialog
          file={pickedFile}
          aspect={1}
          cropShape="round"
          onCancel={() => setPickedFile(null)}
          onCropped={handleCropped}
          submitLabel="আপলোড করুন"
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:text-foreground/80";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
