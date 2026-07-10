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

// Bangladesh Technical Education Board — Diploma in Engineering departments
export const DEPARTMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Civil Technology", label: "Civil Technology" },
  { value: "Civil (Wood) Technology", label: "Civil (Wood) Technology" },
  { value: "Architecture Technology", label: "Architecture Technology" },
  { value: "Surveying Technology", label: "Surveying Technology" },
  { value: "Construction Technology", label: "Construction Technology" },
  { value: "Electrical Technology", label: "Electrical Technology" },
  { value: "Electronics Technology", label: "Electronics Technology" },
  { value: "Computer Science & Technology", label: "Computer Science & Technology" },
  { value: "Computer Technology", label: "Computer Technology" },
  { value: "Data Telecommunication & Networking Technology", label: "Data Telecommunication & Networking Technology" },
  { value: "Telecommunication Technology", label: "Telecommunication Technology" },
  { value: "Mechanical Technology", label: "Mechanical Technology" },
  { value: "Mechatronics Technology", label: "Mechatronics Technology" },
  { value: "Power Technology", label: "Power Technology" },
  { value: "Automobile Technology", label: "Automobile Technology" },
  { value: "Refrigeration & Air Conditioning Technology", label: "Refrigeration & Air Conditioning Technology" },
  { value: "Aeronautical Technology", label: "Aeronautical Technology" },
  { value: "Marine Technology", label: "Marine Technology" },
  { value: "Ship Building Technology", label: "Ship Building Technology" },
  { value: "Chemical Technology", label: "Chemical Technology" },
  { value: "Food Technology", label: "Food Technology" },
  { value: "Environmental Technology", label: "Environmental Technology" },
  { value: "Textile Technology", label: "Textile Technology" },
  { value: "Garments Design & Pattern Making", label: "Garments Design & Pattern Making" },
  { value: "Textile Machine Design & Maintenance", label: "Textile Machine Design & Maintenance" },
  { value: "Instrumentation & Process Control Technology", label: "Instrumentation & Process Control Technology" },
  { value: "Biomedical Engineering Technology", label: "Biomedical Engineering Technology" },
  { value: "Mining & Mine Survey Technology", label: "Mining & Mine Survey Technology" },
  { value: "Ceramic Technology", label: "Ceramic Technology" },
  { value: "Glass Technology", label: "Glass Technology" },
  { value: "Graphic Reproduction & Printing Technology", label: "Graphic Reproduction & Printing Technology" },
  { value: "Agriculture Technology", label: "Agriculture Technology" },
  { value: "Livestock Technology", label: "Livestock Technology" },
  { value: "Fisheries Technology", label: "Fisheries Technology" },
  { value: "Forestry Technology", label: "Forestry Technology" },
  { value: "Tourism & Hospitality Management", label: "Tourism & Hospitality Management" },
  { value: "Other", label: "Other" },
];
