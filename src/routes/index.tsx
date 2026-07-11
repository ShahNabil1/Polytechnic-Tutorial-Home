import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  PlayCircle,
  Users,
  Award,
  Clock,
  CheckCircle2,
  Star,
  Plus,
  Minus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";
import { listFeaturedProducts } from "@/lib/products.functions";
import { listPublicCourses, type PublicCourseCard } from "@/lib/lms.functions";
import { toBanglaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, নোটস, বই ও সুপার সাজেশন — এক জায়গায়।",
      },
    ],
  }),
  component: HomePage,
});

/* ---------- Data ---------- */

const COURSES = [
  {
    dept: "কম্পিউটার",
    title: "কম্পিউটার টেকনোলজি — ১ম থেকে ৮ম পর্ব",
    lessons: 240,
    hours: 120,
    students: 3200,
    price: 2500,
  },
  {
    dept: "সিভিল",
    title: "সিভিল ইঞ্জিনিয়ারিং কমপ্লিট কোর্স",
    lessons: 210,
    hours: 105,
    students: 2100,
    price: 2500,
  },
  {
    dept: "ইলেকট্রিক্যাল",
    title: "ইলেকট্রিক্যাল টেকনোলজি ফুল কোর্স",
    lessons: 195,
    hours: 98,
    students: 1850,
    price: 2500,
  },
];

const PLANS = [
  {
    name: "ফ্রি",
    price: 0,
    tag: "শুরুর জন্য",
    features: [
      "৫টি ফ্রি লেসন",
      "লিমিটেড নোটস অ্যাক্সেস",
      "কমিউনিটি সাপোর্ট",
    ],
  },
  {
    name: "প্রিমিয়াম",
    price: 1500,
    tag: "সবচেয়ে জনপ্রিয়",
    highlight: true,
    features: [
      "সব ভিডিও কোর্স আনলিমিটেড",
      "লাইভ ক্লাস + রেকর্ডিং",
      "সব নোটস ও পিডিএফ",
      "মডেল টেস্ট ও সাজেশন",
      "প্রায়োরিটি সাপোর্ট",
    ],
  },
  {
    name: "প্রো + প্রিন্ট",
    price: 2800,
    tag: "সেরা ভ্যালু",
    features: [
      "প্রিমিয়ামের সব ফিচার",
      "প্রিন্টেড বই বাসায়",
      "সুপার সাজেশন হার্ডকপি",
      "১-অন-১ মেন্টর সেশন",
    ],
  },
];

const TESTIMONIALS = [
  {
    name: "রাকিবুল হাসান",
    role: "কম্পিউটার, ৬ষ্ঠ পর্ব",
    text: "ভিডিও লেকচারগুলো এত সহজ করে বোঝানো — বই খুলে বসতেই ইচ্ছা করে। সাজেশনও কমন এসেছে ৯০%+।",
  },
  {
    name: "তানজিনা আক্তার",
    role: "সিভিল, ৪র্থ পর্ব",
    text: "লাইভ ক্লাসে সরাসরি প্রশ্ন করা যায়, এটাই সবচেয়ে বড় প্লাস। রেজাল্ট আগের চেয়ে অনেক ভালো এসেছে।",
  },
  {
    name: "মেহেদী হাসান",
    role: "ইলেকট্রিক্যাল, ৮ম পর্ব",
    text: "নোটস আর মডেল টেস্ট মিলিয়ে পুরো সিলেবাস কভার হয়ে যায়। ফাইনালের আগে দারুণ কাজে দিয়েছে।",
  },
];

const FAQS = [
  {
    q: "কোর্স কতদিন অ্যাক্সেস করা যাবে?",
    a: "প্রিমিয়াম প্ল্যানে এনরোল করলে পুরো সেমিস্টার জুড়ে সব ভিডিও, নোটস ও লাইভ ক্লাসে আনলিমিটেড অ্যাক্সেস পাবেন।",
  },
  {
    q: "পেমেন্ট কীভাবে করব?",
    a: "বিকাশ, নগদ, রকেট এবং ডেবিট/ক্রেডিট কার্ড — সবগুলো অপশন আছে। পেমেন্ট সাথে সাথেই কোর্স আনলক হয়ে যাবে।",
  },
  {
    q: "ভিডিও কি ডাউনলোড করা যাবে?",
    a: "সিকিউরিটির কারণে ভিডিও ডাউনলোড করা যাবে না, কিন্তু যতবার খুশি স্ট্রিম করে দেখতে পারবেন। নোটস ও পিডিএফ ডাউনলোড করা যাবে।",
  },
  {
    q: "বই অর্ডার করলে কতদিনে পাব?",
    a: "ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ২-৩ কর্মদিবসের মধ্যে পৌঁছে যাবে।",
  },
  {
    q: "কোনো অ্যাকাউন্ট ছাড়াই কি কিনতে পারব?",
    a: "শপ থেকে বই বা সাজেশন কিনতে অ্যাকাউন্ট লাগবে না — গেস্ট চেকআউটে সরাসরি অর্ডার করা যাবে।",
  },
];

/* ---------- Page ---------- */

function HomePage() {
  const fetchFeatured = useServerFn(listFeaturedProducts);
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    fetchFeatured({ data: undefined as never })
      .then((rows) => setFeatured((rows ?? []).slice(0, 4)))
      .catch(() => setFeatured([]));
  }, [fetchFeatured]);

  return (
    <div>
      <Hero />
      <Stats />
      <Courses />
      <ShopStrip products={featured} />
      <Pricing />
      <About />
      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
}

/* ---------- Sections ---------- */

function Hero() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:px-6 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" />
            নতুন সেমিস্টার ২০২৬ এর কোর্স লাইভ
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-balance md:text-5xl lg:text-6xl">
            ডিপ্লোমা ইঞ্জিনিয়ারিং প্রস্তুতির
            <br />
            <span className="text-brand">সম্পূর্ণ প্ল্যাটফর্ম</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            অভিজ্ঞ পলিটেকনিক শিক্ষকদের ভিডিও লেকচার, লাইভ ক্লাস, নোটস,
            মডেল টেস্ট এবং সুপার সাজেশন — সব এক জায়গায়।
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              এনরোল করুন
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#courses"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <PlayCircle className="size-4" />
              কোর্স দেখুন
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { label: "সক্রিয় শিক্ষার্থী", value: "১২,০০০+" },
    { label: "ভিডিও লেসন", value: "১,৫০০+" },
    { label: "লাইভ ক্লাস / সপ্তাহ", value: "২০+" },
    { label: "গড় কমন সাজেশন", value: "৯০%" },
  ];
  return (
    <section className="border-b border-border/60 bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4 md:px-6 md:py-12">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div className="text-2xl font-bold tracking-tight md:text-3xl">
              {s.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground md:text-sm">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Courses() {
  return (
    <section id="courses" className="scroll-mt-20 px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="কোর্স"
          title="বিভাগ অনুযায়ী কমপ্লিট কোর্স"
          desc="প্রতিটি ডিপার্টমেন্টের ১ম থেকে ৮ম পর্ব পর্যন্ত সম্পূর্ণ সিলেবাস কভার করা।"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {COURSES.map((c) => (
            <article
              key={c.title}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/30"
            >
              <div className="text-xs font-medium text-brand">{c.dept}</div>
              <h3 className="mt-2 text-lg font-semibold leading-snug">
                {c.title}
              </h3>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <PlayCircle className="size-3.5" />
                  {toBanglaNumber(c.lessons)} লেসন
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {toBanglaNumber(c.hours)} ঘন্টা
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {toBanglaNumber(c.students)} শিক্ষার্থী
                </span>
              </div>
              <div className="mt-6 flex items-end justify-between border-t border-border pt-5">
                <div>
                  <div className="text-xs text-muted-foreground">শুরু থেকে</div>
                  <div className="font-inter text-xl font-semibold tabular-nums">
                    ৳{toBanglaNumber(c.price)}
                  </div>
                </div>
                <a
                  href="#pricing"
                  className="text-sm font-medium text-foreground transition-colors group-hover:text-brand"
                >
                  বিস্তারিত →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShopStrip({ products }: { products: Product[] }) {
  return (
    <section className="relative px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border-2 border-brand/25 bg-gradient-to-br from-brand-soft/70 via-background to-amber-50/50 p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.15)] md:p-10">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-amber-200/40 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-foreground shadow-md shadow-brand/25">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                অনলাইন শপ · সরাসরি অর্ডার
              </div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
                বই, ই-বুক ও সুপার সাজেশন
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold text-muted-foreground md:text-base">
                কোর্সের পাশাপাশি প্রয়োজনীয় প্রিন্টেড বই, ডিজিটাল ই-বুক ও পরীক্ষার সুপার সাজেশন —
                ঘরে বসেই অর্ডার, দ্রুত ডেলিভারি।
              </p>
            </div>
            <Link
              to="/shop"
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 text-sm font-extrabold text-background shadow-lg transition-all hover:-translate-y-0.5 hover:bg-brand hover:text-brand-foreground hover:shadow-xl hover:shadow-brand/30"
            >
              See All Products
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="প্রাইসিং"
          title="আপনার জন্য সঠিক প্ল্যান বেছে নিন"
          desc="মাসিক বা সেমিস্টার ভিত্তিক — যেকোনো সময় আপগ্রেড করা যাবে।"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "flex flex-col rounded-xl border p-6",
                p.highlight
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium",
                  p.highlight ? "text-background/70" : "text-brand",
                )}
              >
                {p.tag}
              </div>
              <div className="mt-1 text-lg font-semibold">{p.name}</div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-inter text-4xl font-bold tabular-nums">
                  ৳{toBanglaNumber(p.price)}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    p.highlight ? "text-background/70" : "text-muted-foreground",
                  )}
                >
                  / সেমিস্টার
                </span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        p.highlight ? "text-background" : "text-brand",
                      )}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={cn(
                  "mt-8 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90",
                  p.highlight
                    ? "bg-background text-foreground"
                    : "bg-foreground text-background",
                )}
              >
                {p.price === 0 ? "ফ্রি শুরু করুন" : "এনরোল করুন"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  const points = [
    {
      icon: Award,
      title: "অভিজ্ঞ শিক্ষক",
      desc: "নামকরা পলিটেকনিকের ১০+ বছর অভিজ্ঞ শিক্ষকদের সরাসরি লেকচার।",
    },
    {
      icon: PlayCircle,
      title: "স্ট্রাকচার্ড ভিডিও",
      desc: "চ্যাপ্টার ভিত্তিক সাজানো লেসন — ঠিক যেভাবে ক্লাসে পড়ানো হয়।",
    },
    {
      icon: Users,
      title: "লাইভ ইন্টার‍্যাকশন",
      desc: "সপ্তাহে ২০+ লাইভ ক্লাস, প্রশ্ন-উত্তর ও ডাউট সেশন।",
    },
  ];
  return (
    <section id="about" className="scroll-mt-20 border-t border-border/60 bg-surface px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            আমাদের সম্পর্কে
          </div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            পলিটেকনিক শিক্ষার্থীদের কথা ভেবেই তৈরি
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Polytechnic Tutorial Home একটি ফোকাসড এডুকেশন প্ল্যাটফর্ম, যেখানে
            শুধুমাত্র বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য
            কনটেন্ট তৈরি করা হয়। বিএসসি বা এইচএসসির জেনেরিক কোর্স নয় —
            আপনার সিলেবাস, আপনার বোর্ড প্রশ্নের ধরন অনুযায়ী সাজানো।
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            লক্ষ্য একটাই — প্রতিটা শিক্ষার্থী যেন সহজে, স্পষ্ট করে বুঝতে পারে
            এবং পরীক্ষায় ভালো করতে পারে।
          </p>
        </div>
        <div className="space-y-6">
          {points.map((p) => (
            <div key={p.title} className="flex gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-background">
                <p.icon className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-20 px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="শিক্ষার্থীদের অভিজ্ঞতা"
          title="যা বলছেন আমাদের শিক্ষার্থীরা"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-foreground text-foreground" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border/60 bg-surface px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHead
          eyebrow="FAQ"
          title="সাধারণ জিজ্ঞাসা"
          desc="আরও প্রশ্ন থাকলে সরাসরি আমাদের সাথে যোগাযোগ করুন।"
          center
        />
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium md:text-base">{f.q}</span>
                  {isOpen ? (
                    <Minus className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-foreground px-6 py-14 text-center text-background md:px-12">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          আজই শুরু করুন আপনার প্রস্তুতি
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-background/70 md:text-base">
          প্রথম ৫টি লেসন সম্পূর্ণ ফ্রি — কোনো কার্ড লাগবে না।
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-md bg-background px-5 py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
          >
            এনরোল করুন
            <ArrowRight className="size-4" />
          </a>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-md border border-background/30 px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-background/10"
          >
            শপ দেখুন
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Helpers ---------- */

function SectionHead({
  eyebrow,
  title,
  desc,
  center,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}
    </div>
  );
}
