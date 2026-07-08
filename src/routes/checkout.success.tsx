import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, Mail } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  order: z.string().min(1),
  digital: z.coerce.number().optional(),
});

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "অর্ডার সফল — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: SuccessPage,
});

function SuccessPage() {
  const { order, digital } = Route.useSearch();
  const isDigital = digital === 1;

  return (
    <div className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-lg">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-xl md:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
            <CheckCircle2 className="size-9" />
          </div>
          <h1 className="mt-6 text-2xl font-bold md:text-3xl">
            অর্ডার সফল হয়েছে!
          </h1>
          <p className="mt-3 text-muted-foreground">
            আপনার অর্ডারের জন্য ধন্যবাদ। অর্ডার নম্বর:
          </p>
          <p className="mt-1 font-inter text-lg font-bold tracking-wider text-brand">
            {order}
          </p>

          <div className="mt-8 rounded-xl bg-surface p-5 text-left text-sm">
            {isDigital ? (
              <div className="flex gap-3">
                <Download className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <p className="font-semibold">ডাউনলোড লিংক পাঠানো হয়েছে</p>
                  <p className="mt-1 text-muted-foreground">
                    আপনার ইমেইলে সিকিউর ডাউনলোড লিংক পাঠানো হয়েছে। ইমেইল না
                    পেলে স্প্যাম ফোল্ডার চেক করুন।
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <p className="font-semibold">অর্ডার কনফার্মেশন</p>
                  <p className="mt-1 text-muted-foreground">
                    আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে। সাধারণত ২-৩
                    কর্মদিবসে বই আপনার ঠিকানায় পৌঁছে যাবে।
                  </p>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/shop"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          >
            আরো শপিং করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
