import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, ShoppingBag, User as UserIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sdash/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.phone ||
    user?.email ||
    "শিক্ষার্থী";

  const cards = [
    {
      to: "/sdash/courses",
      title: "আমার কোর্স",
      desc: "এনরোল করা কোর্স ও লেসন প্রগ্রেস দেখুন।",
      icon: BookOpen,
    },
    {
      to: "/sdash/shop",
      title: "আমার শপ",
      desc: "অর্ডার হিস্ট্রি, ই-বুক ও ডাউনলোড।",
      icon: ShoppingBag,
    },
    {
      to: "/sdash/profile",
      title: "প্রোফাইল",
      desc: "নাম, ফোন ও অ্যাকাউন্ট সেটিংস আপডেট করুন।",
      icon: UserIcon,
    },
  ] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          স্বাগতম, {name} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার লার্নিং জার্নি এক জায়গায়।
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand/60 hover:bg-secondary/50"
            >
              <div className="mb-3 grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-5" />
              </div>
              <h3 className="text-base font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                খুলুন
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
