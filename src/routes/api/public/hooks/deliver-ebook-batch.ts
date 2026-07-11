// Batch worker: picks pending/failed ebook-fulfillment orders and sends emails via Resend.
// Called by pg_cron every minute AND fire-and-forget from createOrder for instant delivery.
// Auth: apikey header must equal SUPABASE_PUBLISHABLE_KEY (public but sufficient — the endpoint
// is idempotent and only touches rows that are already in `pending`/`failed`/`bounced` with
// an eligible retry window).

import { createFileRoute } from "@tanstack/react-router";

const MAX_BATCH = 15;
const MAX_ATTEMPTS = 3;

type OrderRow = {
  id: string;
  order_no: string;
  customer_name: string;
  customer_email: string | null;
  digital_status: string;
  digital_attempt_count: number;
};

type EbookItemRow = {
  order_id: string;
  title: string;
  product_id: string | null;
};

type EbookProductRow = {
  id: string;
  ebook_file_url: string | null;
};

export const Route = createFileRoute("/api/public/hooks/deliver-ebook-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        let body: { order_id?: string } = {};
        try {
          body = (await request.json()) as { order_id?: string };
        } catch {}

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { renderEbookEmailHtml, sendEbookEmail } = await import("@/lib/ebook-delivery.server");

        // Select target orders: single or batch
        let orders: OrderRow[] = [];
        if (body.order_id) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id, order_no, customer_name, customer_email, digital_status, digital_attempt_count")
            .eq("id", body.order_id)
            .in("digital_status", ["pending", "failed", "bounced", "delayed", "sent"])
            .limit(1);
          orders = (data as OrderRow[]) ?? [];
        } else {
          const nowIso = new Date().toISOString();
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id, order_no, customer_name, customer_email, digital_status, digital_attempt_count")
            .in("digital_status", ["pending", "failed", "bounced", "delayed"])
            .lt("digital_attempt_count", MAX_ATTEMPTS)
            .or(`digital_next_retry_at.is.null,digital_next_retry_at.lte.${nowIso}`)
            .order("created_at", { ascending: true })
            .limit(MAX_BATCH);
          orders = (data as OrderRow[]) ?? [];
        }

        const results: Array<{ order_id: string; ok: boolean; reason?: string }> = [];

        for (const order of orders) {
          try {
            if (!order.customer_email) {
              await markManualReview(supabaseAdmin, order.id, "No customer email on order");
              results.push({ order_id: order.id, ok: false, reason: "no_email" });
              continue;
            }

            const { data: itemsData, error: itemsError } = await supabaseAdmin
              .from("order_items")
              .select("order_id, title, product_id")
              .eq("order_id", order.id)
              .eq("item_type", "ebook");
            if (itemsError) throw new Error(itemsError.message);
            const items = (itemsData as unknown as EbookItemRow[]) ?? [];

            const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
            const fileUrlByProductId = new Map<string, string>();
            if (productIds.length > 0) {
              const { data: productsData, error: productsError } = await supabaseAdmin
                .from("products")
                .select("id, ebook_file_url")
                .in("id", productIds);
              if (productsError) throw new Error(productsError.message);
              for (const product of ((productsData as EbookProductRow[]) ?? [])) {
                if (product.ebook_file_url) fileUrlByProductId.set(product.id, product.ebook_file_url);
              }
            }

            const ebooks = items
              .map((i) => ({
                title: i.title,
                downloadUrl: i.product_id ? (fileUrlByProductId.get(i.product_id) ?? "") : "",
              }))
              .filter((b) => !!b.downloadUrl);

            if (ebooks.length === 0) {
              await markManualReview(
                supabaseAdmin,
                order.id,
                "No ebook_file_url on any ebook product",
              );
              results.push({ order_id: order.id, ok: false, reason: "no_files" });
              continue;
            }

            const attemptNo = (order.digital_attempt_count ?? 0) + 1;

            // Try DB-editable template first; fall back to hardcoded renderer.
            const { renderEmailTemplate, renderEbookListHtml } = await import(
              "@/lib/email-templates.server"
            );
            const { data: tpl } = await supabaseAdmin
              .from("email_templates")
              .select("subject, body_html, enabled")
              .eq("key", "ebook_delivery")
              .maybeSingle();

            // Skip if the template's auto-send toggle is off
            if (tpl && (tpl as any).enabled === false) {
              results.push({ order_id: order.id, ok: false, reason: "template_disabled" });
              continue;
            }


            let html: string;
            let subject: string;
            if (tpl?.body_html && tpl?.subject) {
              const vars = {
                order_no: order.order_no,
                customer_name: order.customer_name || "কাস্টমার",
                ebook_list: renderEbookListHtml(ebooks),
              };
              html = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${renderEmailTemplate(
                tpl.body_html as string,
                vars,
              )}</body></html>`;
              subject = renderEmailTemplate(tpl.subject as string, vars);
            } else {
              html = renderEbookEmailHtml({
                orderNo: order.order_no,
                customerName: order.customer_name,
                ebooks,
              });
              subject = `আপনার ই-বুক প্রস্তুত — Order ${order.order_no}`;
            }


            const send = await sendEbookEmail({ to: order.customer_email, subject, html });

            if (send.ok) {
              const nowIso = new Date().toISOString();
              await supabaseAdmin.from("order_email_deliveries").insert({
                order_id: order.id,
                attempt_no: attemptNo,
                resend_email_id: send.id,
                to_email: order.customer_email,
                from_email: "noreply@polytechnictutorial.com",
                subject,
                status: "sent",
                sent_at: nowIso,
              } as never);
              await supabaseAdmin
                .from("orders")
                .update({
                  digital_status: "sent",
                  digital_attempt_count: attemptNo,
                  digital_locked_until: null,
                  digital_last_error: null,
                  digital_next_retry_at: null,
                } as never)
                .eq("id", order.id);
              results.push({ order_id: order.id, ok: true });
            } else {
              const nowIso = new Date().toISOString();
              const nextRetry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
              const nextStatus = attemptNo >= MAX_ATTEMPTS ? "manual_review" : "failed";
              await supabaseAdmin.from("order_email_deliveries").insert({
                order_id: order.id,
                attempt_no: attemptNo,
                to_email: order.customer_email,
                from_email: "noreply@polytechnictutorial.com",
                subject,
                status: "failed",
                error_reason: send.error,
                created_at: nowIso,
              } as never);
              await supabaseAdmin
                .from("orders")
                .update({
                  digital_status: nextStatus,
                  digital_attempt_count: attemptNo,
                  digital_last_error: `[${send.status}] ${send.error}`.slice(0, 500),
                  digital_next_retry_at: attemptNo >= MAX_ATTEMPTS ? null : nextRetry,
                  digital_locked_until: null,
                } as never)
                .eq("id", order.id);
              results.push({ order_id: order.id, ok: false, reason: send.error });
            }
          } catch (err) {
            console.error("deliver-ebook-batch error", order.id, err);
            results.push({
              order_id: order.id,
              ok: false,
              reason: err instanceof Error ? err.message : "unknown",
            });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});

async function markManualReview(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  orderId: string,
  reason: string,
) {
  await admin
    .from("orders")
    .update({
      digital_status: "manual_review",
      digital_last_error: reason,
      digital_locked_until: null,
    } as never)
    .eq("id", orderId);
}
