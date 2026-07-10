import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRole, primaryHome } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal")({
  component: InternalLayout,
});

function InternalLayout() {
  const { info, loading, isInternal } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !info) return;
    if (!isInternal) {
      navigate({ to: primaryHome(info.primaryRole), replace: true });
    }
  }, [loading, info, isInternal, navigate]);

  if (loading || !info) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isInternal) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        রিডাইরেক্ট করা হচ্ছে…
      </div>
    );
  }

  return <Outlet />;
}
