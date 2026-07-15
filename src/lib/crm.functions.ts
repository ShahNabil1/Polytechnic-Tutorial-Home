import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types ----------

export type CrmCustomerRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  signed_up_at: string;
  order_count: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  active_enrollments: number;
  total_enrollments: number;
  segment: "active" | "signed_no_purchase";
};

export type CrmGuestRow = {
  phone: string;
  email: string | null;
  name: string | null;
  order_count: number;
  total_spent: number;
  first_order_at: string;
  last_order_at: string;
};

export type CrmIncompleteRow = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  subtotal_bdt: number;
  total_bdt: number;
  attempt_count: number;
  last_outcome: string;
  first_attempt_at: string;
  last_attempt_at: string;
  cart: any;
};

export type CrmCustomerDetail = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  signed_up_at: string;
  segment: "active" | "signed_no_purchase";
  ltv: {
    order_count: number;
    total_spent: number;
    avg_order_value: number;
    first_order_at: string | null;
    last_order_at: string | null;
    active_enrollments: number;
    total_enrollments: number;
  };
  orders: Array<{
    id: string;
    order_no: string;
    status: string;
    payment_status: string;
    total_bdt: number;
    created_at: string;
  }>;
  enrollments: Array<{
    id: string;
    course_id: string;
    course_title: string | null;
    granted_at: string;
    expires_at: string | null;
  }>;
};

// ---------- Auth guard ----------

async function ensureCanManageCrm(context: { supabase: any; userId: string }) {
  const { data: canManage, error } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_users",
  });
  if (error) throw new Error(error.message);
  if (canManage !== true) throw new Error("Forbidden: manage_users only");
}

// ---------- List functions ----------

const listInput = z
  .object({
    search: z.string().max(200).optional(),
    segment: z.enum(["all", "active", "signed_no_purchase"]).optional(),
  })
  .optional();

export const listCrmCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManageCrm(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_customers").select("*");
    const seg = data?.segment ?? "all";
    if (seg !== "all") q = q.eq("segment", seg);
    if (data?.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q
      .order("last_order_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmCustomerRow[];
  });

export const listCrmGuestPurchased = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(200).optional() }).optional().parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManageCrm(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_guest_purchased").select("*");
    if (data?.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`phone.ilike.%${s}%,email.ilike.%${s}%,name.ilike.%${s}%`);
    }
    const { data: rows, error } = await q
      .order("last_order_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmGuestRow[];
  });

export const listCrmIncompleteLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(200).optional() }).optional().parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManageCrm(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_incomplete_leads").select("*");
    if (data?.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`phone.ilike.%${s}%,email.ilike.%${s}%,name.ilike.%${s}%`);
    }
    const { data: rows, error } = await q
      .order("last_attempt_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmIncompleteRow[];
  });

// ---------- Detail ----------

export const getCrmCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManageCrm(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: summary, error: sErr } = await supabaseAdmin
      .from("crm_customers")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!summary) throw new Error("Customer not found");

    const [{ data: orders, error: oErr }, { data: enrollments, error: eErr }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_no, status, payment_status, total_bdt, created_at")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("lms_enrollments")
        .select("id, course_id, granted_at, expires_at, lms_courses(title)")
        .eq("user_id", data.user_id)
        .order("granted_at", { ascending: false })
        .limit(100),
    ]);
    if (oErr) throw new Error(oErr.message);
    if (eErr) throw new Error(eErr.message);

    const orderCount = summary.order_count ?? 0;
    const totalSpent = Number(summary.total_spent ?? 0);
    const detail: CrmCustomerDetail = {
      user_id: summary.user_id as string,
      full_name: summary.full_name,
      email: summary.email,
      phone: summary.phone,
      avatar_url: summary.avatar_url,
      signed_up_at: (summary.signed_up_at ?? new Date().toISOString()) as string,
      segment: (summary.segment ?? "signed_no_purchase") as "active" | "signed_no_purchase",
      ltv: {
        order_count: orderCount,
        total_spent: totalSpent,
        avg_order_value: orderCount > 0 ? totalSpent / orderCount : 0,
        first_order_at: summary.first_order_at,
        last_order_at: summary.last_order_at,
        active_enrollments: summary.active_enrollments ?? 0,
        total_enrollments: summary.total_enrollments ?? 0,
      },
      orders: (orders ?? []).map((o: any) => ({
        id: o.id,
        order_no: o.order_no,
        status: o.status,
        payment_status: o.payment_status,
        total_bdt: Number(o.total_bdt),
        created_at: o.created_at,
      })),
      enrollments: (enrollments ?? []).map((e: any) => ({
        id: e.id,
        course_id: e.course_id,
        course_title: e.lms_courses?.title ?? null,
        granted_at: e.granted_at,
        expires_at: e.expires_at,
      })),
    };
    return detail;
  });
