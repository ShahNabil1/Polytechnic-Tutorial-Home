import { createFileRoute } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/")({
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { info } = useRole();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">স্বাগতম</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার রোল: <span className="font-medium text-foreground">{info?.primaryRole}</span>
        </p>
        {info?.permissions && info.permissions.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium">গ্র্যান্টেড পারমিশন:</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {info.permissions.map((p) => (
                <li key={p} className="rounded-md bg-secondary px-2 py-1 text-xs">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        এমপ্লয়ি/ইন্সট্রাক্টর ম্যানেজমেন্ট, 2FA সেটআপ, প্রোফাইল ও আরও ফিচার পরবর্তী স্টেপে যোগ হবে।
      </div>
    </div>
  );
}
