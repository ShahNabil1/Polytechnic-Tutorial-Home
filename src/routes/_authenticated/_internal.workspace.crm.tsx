import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";
import { Users, UserPlus, ShoppingBag, AlertCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmsBalanceAlert, useSmsGatewayHealth, classifyBalance } from "@/components/internal/crm/SmsBalanceAlert";

export const Route = createFileRoute("/_authenticated/_internal/workspace/crm")({
  head: () => ({
    meta: [{ title: "CRM — Workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: CrmLayout,
});

const TABS = [
  { to: "/workspace/crm/customers", label: "Customers", icon: Users },
  { to: "/workspace/crm/signed", label: "Signed · No purchase", icon: UserPlus },
  { to: "/workspace/crm/guests", label: "Guest purchases", icon: ShoppingBag },
  { to: "/workspace/crm/incomplete", label: "Incomplete leads", icon: AlertCircle },
  { to: "/workspace/crm/campaigns", label: "Campaigns", icon: Send },
] as const;

function CrmLayout() {
  const { loading, has } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { sms } = useSmsGatewayHealth();
  const level = classifyBalance(sms);
  if (loading) return null;
  if (!has("manage_users")) {
    throw redirect({ to: "/workspace" });
  }

  const isDetail = /\/workspace\/crm\/[0-9a-f-]{36}$/i.test(pathname);

  return (
    <div className="min-h-screen bg-background">
      {!isDetail && (
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
            <nav className="flex gap-1 py-2">
              {TABS.map((t) => {
                const active = pathname.startsWith(t.to);
                const Icon = t.icon;
                const showDot = t.to === "/workspace/crm/campaigns" && (level === "warn" || level === "critical");
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={cn(
                      "relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t.label}
                    {showDot && (
                      <span
                        className={cn(
                          "ml-1 inline-block size-2 rounded-full",
                          level === "critical" ? "bg-red-500" : "bg-amber-500",
                        )}
                        title={level === "critical" ? "SMS balance critically low" : "SMS balance low"}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      {!isDetail && <SmsBalanceAlert />}
      <Outlet />
    </div>
  );
}
