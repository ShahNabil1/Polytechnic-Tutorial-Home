import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Truck, ShieldCheck, Zap } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts, DEPARTMENTS } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "পলিটেকনিক এডু — বই, ই-বুক ও সুপার সাজেশন" },
      {
        name: "description",
        content:
          "বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ছাত্র-ছাত্রীদের জন্য পাঠ্যবই, ই-বুক এবং পরীক্ষার সুপার সাজেশন। গেস্ট চেকআউটে সরাসরি অর্ডার করুন।",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const featured = getFeaturedProducts();

  return (
    <div>
      {/* Hero */}
      <section className="px-4 pt-10 md:px-6 md:pt-16 lg:pt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/15"
            >
              <Zap className="size-3.5" />
              নতুন সেমিস্টার ২০২৬
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              পলিটেকনিক পরীক্ষার{" "}
              <span className="text-brand">সেরা প্রস্তুতি</span> এখন আপনার
              হাতের মুঠোয়।
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ছাত্র-ছাত্রীদের জন্য প্রয়োজনীয় সকল
              পাঠ্যবই, ই-বুক এবং পরীক্ষার জন্য ১০০% কমন সুপার সাজেশন — এক
              জায়গায়।
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                শপ ব্রাউজ করুন
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/shop"
                search={{ type: "suggestion" }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                সুপার সাজেশন দেখুন
              </Link>
            </motion.div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-brand" />
                সারা দেশে ২-৩ দিনে ডেলিভারি
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" />
                ১০০% পেমেন্ট নিরাপত্তা
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 p-6 ring-1 ring-border shadow-xl">
              <div className="grid h-full grid-cols-2 gap-4">
                {featured.slice(0, 4).map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className={`flex aspect-[3/4] items-center justify-center rounded-xl bg-gradient-to-br text-5xl shadow-lg ${p.coverColor} ${
                      i % 2 === 0 ? "mt-6" : ""
                    }`}
                  >
                    <span className="drop-shadow-md">{p.coverEmoji}</span>
                  </motion.div>
                ))}
              </div>
              <div className="absolute -bottom-4 -left-4 rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <p className="font-inter text-xs font-medium text-muted-foreground">
                      Total Books
                    </p>
                    <p className="font-inter text-sm font-bold tabular-nums">
                      ১০০+ টাইটেল
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Departments */}
      <section className="mt-24 border-y border-border/60 bg-surface py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                বিভাগ অনুযায়ী খুঁজুন
              </h2>
              <p className="mt-2 text-muted-foreground">
                আপনার ডিপার্টমেন্ট বেছে নিয়ে প্রয়োজনীয় বই খুঁজুন।
              </p>
            </div>
            <Link
              to="/shop"
              className="text-sm font-semibold text-brand hover:underline"
            >
              সবগুলো বিভাগ →
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {DEPARTMENTS.map((d) => (
              <Link
                key={d.id}
                to="/shop"
                search={{ department: d.id }}
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all hover:border-brand hover:text-brand hover:shadow-sm"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="mt-20 px-4 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                জনপ্রিয় বইসমূহ
              </h2>
              <p className="mt-2 text-muted-foreground">
                শিক্ষার্থীদের সবচেয়ে পছন্দের বই ও সাজেশন।
              </p>
            </div>
            <Link
              to="/shop"
              className="hidden text-sm font-semibold text-brand hover:underline md:block"
            >
              সবগুলো দেখুন →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mt-24 px-4 md:px-6">
        <div className="mx-auto max-w-7xl rounded-3xl border border-border bg-surface p-8 md:p-12">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "নির্ভুল সাজেশন",
                desc: "অভিজ্ঞ পলিটেকনিক শিক্ষকদের দ্বারা যাচাইকৃত সাজেশন — বোর্ড পরীক্ষায় ৯০%+ কমনের নিশ্চয়তা।",
              },
              {
                icon: Truck,
                title: "দ্রুত ডেলিভারি",
                desc: "সারা বাংলাদেশে ২-৩ কর্মদিবসে বই পৌঁছে যাবে আপনার দরজায়। ডিজিটাল প্রোডাক্ট ইনস্ট্যান্ট ডাউনলোড।",
              },
              {
                icon: Zap,
                title: "সহজ পেমেন্ট",
                desc: "বিকাশ, নগদ, রকেট বা কার্ডে খুব সহজেই পেমেন্ট। অ্যাকাউন্ট খোলার কোনো ঝামেলা নেই।",
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
