/**
 * Email templates CRUD server functions.
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

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(160),
        subject: z.string().min(1).max(300),
        body_html: z.string().min(1).max(50000),
        variables: z.array(z.string().max(60)).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("email_templates")
        .update({
          name: data.name,
          subject: data.subject,
          body_html: data.body_html,
          variables: data.variables ?? [],
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("email_templates")
      .insert({
        name: data.name,
        subject: data.subject,
        body_html: data.body_html,
        variables: data.variables ?? [],
        is_system: false,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id as string };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEmailTemplateEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("email_templates")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

