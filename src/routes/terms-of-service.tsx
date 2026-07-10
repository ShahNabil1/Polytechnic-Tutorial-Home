import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Scale, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "Polytechnic Tutorial Home-র সেবা ব্যবহারের শর্তাবলী।",
      },
      { property: "og:title", content: "Terms of Service — Polytechnic Tutorial Home" },
      {
        property: "og:description",
        content: "Polytechnic Tutorial Home-র সেবা ব্যবহারের শর্তাবলী।",
      },
    ],
  }),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  return (
    <div className="px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Scale className="size-5" />
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Legal
          </div>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          শর্তাবলী — Polytechnic Tutorial Home
        </p>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
          <p>
            এই পেজটি Polytechnic Tutorial Home কর্তৃক রক্ষণাবেক্ষণ করা হয়।
            এখানে বর্ণিত শর্তাবলী আমাদের প্ল্যাটফর্ম এবং সেবাসমূহ ব্যবহারের
            সাধারণ নিয়ম নির্ধারণ করে।
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">১. শর্তাবলী গ্রহণ</h2>
            <p className="mt-3">
              Polytechnic Tutorial Home-র ওয়েবসাইট বা মোবাইল-সংস্করণে প্রবেশ
              এবং ব্যবহার করার মাধ্যমে আপনি এই শর্তাবলী মেনে চলতে সম্মত হন।
              যদি আপনি এই শর্তাবলীর কোনো অংশে একমত না হন, অনুগ্রহ করে আমাদের
              সেবা ব্যবহার করবেন না।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">২. সেবার বিবরণ</h2>
            <p className="mt-3">
              Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং
              শিক্ষার্থীদের জন্য অনলাইন কোর্স, ভিডিও লেকচার, বই, ই-বুক,
              সুপার সাজেশন এবং সম্পর্কিত শিক্ষা সামগ্রী প্রদান করে। কোনো কোনো
              সেবা নিবন্ধনের মাধ্যমে বা ক্রয় সাপেক্ষে পাওয়া যায়।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৩. অ্যাকাউন্ট এবং নিরাপত্তা</h2>
            <p className="mt-3">
              আপনি আপনার অ্যাকাউন্টের তথ্য সঠিক এবং হালনাগাদ রাখার দায়িত্ব
              বহন করেন। Google বা অন্য OAuth প্রদানকারীর মাধ্যমে সাইন ইন করলে
              সেই প্রদানকারীর নিরাপত্তা নীতিমালারও আপনাকে মেনে চলতে হবে।
              অ্যাকাউন্টের কোনো অপব্যবহার দেখতে পেলে অনুগ্রহ করে আমাদের সাথে
              যোগাযোগ করুন।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৪. ক্রয় এবং পেমেন্ট</h2>
            <p className="mt-3">
              আমাদের শপ থেকে পণ্য বা কোর্স কিনলে প্রদর্শিত মূল্য এবং
              পেমেন্ট-পদ্ধতি প্রযোজ্য হবে। ডিজিটাল কন্টেন্ট কিনে ফেলার পর
              নির্ধারিত শর্তে রিফান্ডের আবেদন করা যেতে পারে। পণ্য ডেলিভারি
              সম্পর্কিত নির্দেশিকা শপ পেজে বা কনফার্মেশন ইমেইলে দেওয়া হয়।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৫. বুদ্ধিবৃত্তিক সম্পত্তি</h2>
            <p className="mt-3">
              প্ল্যাটফর্মে থাকা সব কন্টেন্ট — ভিডিও, লেখা, লোগো, গ্রাফিক্স,
              সাজেশন — Polytechnic Tutorial Home বা তার লাইসেন্সদাতাদের
              সম্পত্তি। অনুমতি ছাড়া এগুলো ডাউনলোড, কপি, বিতরণ বা পুনর্বিক্রয়
              করা নিষিদ্ধ।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৬. নিষিদ্ধ কার্যকলাপ</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>অন্যের অ্যাকাউন্টে অননুমোদিত প্রবেশ।</li>
              <li>কন্টেন্ট ডাউনলোড, রিপোসিটরি বা পাইরেসি।</li>
              <li>প্ল্যাটফর্মের নিরাপত্তা ব্যাহত করা।</li>
              <li>অন্য ব্যবহারকারী বা শিক্ষকদের প্রতি অবমাননাকর আচরণ।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৭. সেবা পরিবর্তন ও বাতিল</h2>
            <p className="mt-3">
              আমরা যেকোনো সময় সেবার বিষয়বস্তু, মূল্য বা উপলব্ধতা পরিবর্তন
              করতে পারি। নিয়ম লঙ্ঘনের ক্ষেত্রে অ্যাকাউন্ট স্থগিত বা বাতিল
              করার অধিকার আমাদের রয়েছে।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৮. দায়মুক্তি</h2>
            <p className="mt-3">
              Polytechnic Tutorial Home সর্বোচ্চ চেষ্টা করলেও প্ল্যাটফর্মের
              ব্যবহার থেকে সৃষ্ট যেকোনো ক্ষতির জন্য আইন অনুমোদিত সর্বোচ্চ
              পরিমাণে দায়বদ্ধতা সীমিত থাকবে। কোনো শর্তাবলী আপনার আইনগত
              অধিকার কমাতে পারে না।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৯. যোগাযোগ</h2>
            <p className="mt-3">
              এই শর্তাবলী নিয়ে প্রশ্ন থাকলে আমাদের সাথে যোগাযোগ করুন:
              {" "}
              <a
                href="mailto:support@polytechnictutorial.com"
                className="text-brand hover:underline"
              >
                support@polytechnictutorial.com
              </a>
            </p>
          </section>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <h3 className="font-semibold text-foreground">মনে রাখবেন</h3>
                <p className="mt-1 text-sm">
                  এই পেজটি অ্যাপ-মালিকানাধীন সম্পাদনাযোগ্য বিষয়বস্তু। এটি
                  কোনো আইনি পরামর্শ বা বাহ্যিক স্বতন্ত্র যাচাইপত্র নয়।
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" />
          <span>সম্পর্কিত:</span>
          <Link to="/privacy-policy" className="text-brand hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
