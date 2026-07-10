import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, FileText, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "Polytechnic Tutorial Home-র ব্যবহারকারী তথ্যের গোপনীয়তা নীতিমালা।",
      },
      { property: "og:title", content: "Privacy Policy — Polytechnic Tutorial Home" },
      {
        property: "og:description",
        content: "Polytechnic Tutorial Home-র ব্যবহারকারী তথ্যের গোপনীয়তা নীতিমালা।",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Shield className="size-5" />
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Privacy
          </div>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          গোপনীয়তা নীতিমালা — Polytechnic Tutorial Home
        </p>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
          <p>
            এই পেজটি Polytechnic Tutorial Home কর্তৃক রক্ষণাবেক্ষণ করা হয়।
            এখানে বর্ণিত নীতিমালা আমাদের প্ল্যাটফর্ম ব্যবহারের সময় আমরা কীভাবে
            আপনার তথ্য সংগ্রহ, ব্যবহার এবং রক্ষা করি সেটি ব্যাখ্যা করে।
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">১. আমরা কী তথ্য সংগ্রহ করি</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">অ্যাকাউন্ট তথ্য:</strong> নাম,
                ইমেইল ঠিকানা, প্রোফাইল ছবি (ঐচ্ছিক) এবং লগইন শনাক্তকারী।
              </li>
              <li>
                <strong className="text-foreground">Google OAuth ডেটা:</strong> Google
                দিয়ে সাইন ইন করলে আমরা Google-র অনুমোদিত স্কোপ অনুযায়ী আপনার
                নাম, ইমেইল এবং প্রোফাইল ছবি পেতে পারি। আমরা Google-র কোনো
                সংবেদনশীল তথ্য (password, ব্রাউজিং ইতিহাস, Gmail ইত্যাদি) সংগ্রহ
                করি না।
              </li>
              <li>
                <strong className="text-foreground">ক্রয় তথ্য:</strong> অর্ডার
                ইতিহাস, পেমেন্ট রসিদ এবং ডেলিভারি ঠিকানা।
              </li>
              <li>
                <strong className="text-foreground">ব্যবহার ডেটা:</strong> পেজ ভিজিট,
                ডিভাইস টাইপ, ব্রাউজার এবং সমস্যা রিপোর্ট (অনুমতি সাপেক্ষে)।
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">২. তথ্য কীভাবে ব্যবহার হয়</h2>
            <p className="mt-3">
              আমরা আপনার তথ্য ব্যবহার করি — অ্যাকাউন্ট পরিচালনা, কোর্স ও পণ্য
              সরবরাহ, কেনাকাটা নিশ্চিতকরণ, কাস্টমার সাপোর্ট এবং প্ল্যাটফর্ম
              উন্নতির জন্য। আমরা আপনাকে স্প্যাম বা অননুমোদিত মার্কেটিং ইমেইল
              পাঠাই না।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৩. Google OAuth এবং তৃতীয় পক্ষ</h2>
            <p className="mt-3">
              Google Sign-In ব্যবহার করলে আমরা Google API সার্ভিসেসের ব্যবহারকারী
              ডেটা নীতিমালা মেনে চলি। Google-র মাধ্যমে প্রাপ্ত তথ্য শুধুমাত্র
              আপনার অ্যাকাউন্ট তৈরি এবং লগইন সুবিধা দিতে ব্যবহৃত হয়। তৃতীয়
              পক্ষের কাছে বিক্রয় বা বিজ্ঞাপনের জন্য আমরা তথ্য শেয়ার করি না।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৪. কুকিজ এবং অ্যানালিটিক্স</h2>
            <p className="mt-3">
              আমাদের প্ল্যাটফর্ম কার্যক্ষমতা এবং নিরাপত্তা নিশ্চিত করতে কুকিজ
              ব্যবহার করতে পারে। সম্ভব হলে আমরা অ্যানালিটিক্স টুল ব্যবহার করি
              যাতে ব্যবহারকারীদের গোপনীয়তা সম্মান করা হয়। আপনি চাইলে ব্রাউজার
              সেটিংস থেকে কুকিজ নিয়ন্ত্রণ করতে পারেন।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৫. তথ্য শেয়ারিং</h2>
            <p className="mt-3">
              আমরা আপনার ব্যক্তিগত তথ্য শুধুমাত্র নিম্নলিখিত ক্ষেত্রে শেয়ার
              করি — পেমেন্ট গেটওয়ে (bKash, Nagad, Stripe, Paddle ইত্যাদি), কুরিয়ার
              সেবা (পণ্য ডেলিভারির জন্য), এবং আইনি প্রয়োজনে কর্তৃপক্ষের
              অনুরোধ।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৬. তথ্য সংরক্ষণ এবং নিরাপত্তা</h2>
            <p className="mt-3">
              আমরা আপনার তথ্য শিল্প-মানের নিরাপত্তা ব্যবস্থা (encryption, access
              control, secure hosting) ব্যবহার করে রক্ষা করার চেষ্টা করি।
              অ্যাকাউন্ট নিষ্ক্রিয় হলে অথবা আপনি ডিলিটের অনুরোধ করলে আমরা
              প্রযোজ্য আইন অনুযায়ী তথ্য মুছে ফেলি।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৭. আপনার অধিকার</h2>
            <p className="mt-3">
              আপনার তথ্য দেখতে, সংশোধন করতে, ডিলিট করতে বা পোর্টেবল কপি চাইতে
              পারেন। এজন্য অনুগ্রহ করে আমাদের সাথে যোগাযোগ করুন।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৮. শিশুদের গোপনীয়তা</h2>
            <p className="mt-3">
              আমাদের সেবা ১৩ বছরের কম বয়সীদের জন্য নয়। আমরা ইচ্ছাকৃতভাবে
              শিশুদের তথ্য সংগ্রহ করি না।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">৯. নীতিমালার পরিবর্তন</h2>
            <p className="mt-3">
              আমরা এই Privacy Policy সময়ে সময়ে হালনাগাদ করতে পারি। গুরুত্বপূর্ণ
              পরিবর্তন হলে প্ল্যাটফর্মে বিজ্ঞপ্তি দেওয়া হবে।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">১০. যোগাযোগ</h2>
            <p className="mt-3">
              গোপনীয়তা সংক্রান্ত যেকোনো প্রশ্নের জন্য আমাদের সাথে যোগাযোগ করুন:
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
                  কোনো বাহ্যিক স্বতন্ত্র যাচাইপত্র বা আইনি পরামর্শ নয়।
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" />
          <span>সম্পর্কিত:</span>
          <Link to="/terms-of-service" className="text-brand hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
