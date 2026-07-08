import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Target, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "আমাদের সম্পর্কে — Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ছাত্র-ছাত্রীদের জন্য একটি ভরসাযোগ্য শিক্ষা প্ল্যাটফর্ম।",
      },
      { property: "og:title", content: "আমাদের সম্পর্কে — Polytechnic Tutorial Home" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          আমাদের সম্পর্কে
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ছাত্র-ছাত্রীদের
          জন্য তৈরি একটি নির্ভরযোগ্য অনলাইন শিক্ষা ও ই-কমার্স প্ল্যাটফর্ম।
          আমাদের লক্ষ্য হলো — মানসম্মত পাঠ্যবই, ই-বুক এবং পরীক্ষার সুপার
          সাজেশন সহজেই ছাত্র-ছাত্রীদের হাতে পৌঁছে দেওয়া।
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Target,
              title: "আমাদের লক্ষ্য",
              desc: "প্রতিটি ডিপ্লোমা শিক্ষার্থীর সফলতা নিশ্চিত করা।",
            },
            {
              icon: BookOpen,
              title: "মানসম্মত কন্টেন্ট",
              desc: "অভিজ্ঞ শিক্ষকদের যাচাইকৃত বই ও সাজেশন।",
            },
            {
              icon: Users,
              title: "কমিউনিটি",
              desc: "১০,০০০+ শিক্ষার্থীর ভরসার প্ল্যাটফর্ম।",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
