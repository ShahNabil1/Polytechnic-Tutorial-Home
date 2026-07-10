import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProfileRow = Tables<"profiles">;

export const REQUIRED_STUDENT_FIELDS: Array<keyof ProfileRow> = [
  "full_name",
  "institute_name",
  "department_name",
  "current_semester",
  "board_roll",
  "registration_no",
];

export const FIELD_LABELS_BN: Record<string, string> = {
  full_name: "পূর্ণ নাম",
  institute_name: "ইনস্টিটিউট",
  department_name: "ডিপার্টমেন্ট",
  current_semester: "সেমিস্টার",
  board_roll: "বোর্ড রোল",
  registration_no: "রেজিস্ট্রেশন নম্বর",
};

export function getMissingProfileFields(profile: Partial<ProfileRow> | null | undefined): string[] {
  if (!profile) return REQUIRED_STUDENT_FIELDS.map((f) => String(f));
  return REQUIRED_STUDENT_FIELDS.filter((f) => {
    const v = profile[f];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  }).map((f) => String(f));
}

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const SEMESTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1st", label: "১ম সেমিস্টার" },
  { value: "2nd", label: "২য় সেমিস্টার" },
  { value: "3rd", label: "৩য় সেমিস্টার" },
  { value: "4th", label: "৪র্থ সেমিস্টার" },
  { value: "5th", label: "৫ম সেমিস্টার" },
  { value: "6th", label: "৬ষ্ঠ সেমিস্টার" },
  { value: "7th", label: "৭ম সেমিস্টার" },
  { value: "8th", label: "৮ম সেমিস্টার" },
  { value: "graduated", label: "Graduated" },
  { value: "probation", label: "Probation" },
];
