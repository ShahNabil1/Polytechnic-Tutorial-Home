/**
 * SMS templates + send-to-customer server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(context: { supabase: any; userId: string }) {
  const [{ data: isEmp }, { data: isAdm }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "employee" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!isEmp && !isAdm) throw new Error("Forbidden");
}

export const listSmsTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("sms_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertSmsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        body: z.string().min(1).max(1000),
        variables: z.array(z.string().max(40)).max(30).optional(),
        category: z.string().min(1).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("sms_templates")
        .update({
          name: data.name,
          body: data.body,
          variables: data.variables ?? [],
          ...(data.category ? { category: data.category } : {}),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("sms_templates")
      .insert({
        name: data.name,
        body: data.body,
        variables: data.variables ?? [],
        category: data.category ?? "other",
        is_system: false,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id as string };
  });

export const deleteSmsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase.from("sms_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSmsTemplateEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("sms_templates")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Send a raw SMS to the customer of an order via Bulksmsbd. */
export const sendOrderSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        message: z.string().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, customer_phone, customer_name")
      .eq("id", data.orderId)
      .single();
    if (error) throw new Error(error.message);
    if (!order?.customer_phone) throw new Error("Order has no phone number");

    const { sendBulksmsbd } = await import("@/lib/sms.server");
    const res = await sendBulksmsbd({ to: order.customer_phone, message: data.message });
    if (!res.ok) throw new Error(`SMS provider failed: ${res.response}`);
    return { ok: true, to: order.customer_phone };
  });
