import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  Home,
  ShoppingBag,
  LayoutGrid,
  Package,
  Tags,
  Ticket,
  GraduationCap,
  Users,
  Settings,
  UserCog,
  BookOpen,
  MessageSquareText,
  Mail,

} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { InternalShell, type NavGroup } from "@/components/internal/InternalShell";

export const Route = createFileRoute("/_authenticated/_internal/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { info } = useRole();
  const isSuperAdmin = info?.primaryRole === "super_admin";

  const groups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      icon: Home,
      items: [{ to: "/workspace", label: "Home", icon: Home, exact: true }],
    },
    {
      id: "ecommerce",
      label: "E-Commerce",
      icon: ShoppingBag,
      items: [
        { to: "/workspace/ecommerce", label: "Dashboard", icon: LayoutGrid, exact: true },
        { to: "/workspace/ecommerce/orders", label: "Orders", icon: ShoppingBag },
        { to: "/workspace/ecommerce/products", label: "Products", icon: Package },
        { to: "/workspace/ecommerce/categories", label: "Categories", icon: Tags },
        { to: "/workspace/ecommerce/coupons", label: "Coupons", icon: Ticket },
      ],
    },
    {
      id: "lms",
      label: "LMS & Courses",
      icon: BookOpen,
      items: [
        { to: "/workspace/lms-and-courses/structure", label: "Academic Structure", icon: GraduationCap },
        { to: "/workspace/lms-and-courses/subjects", label: "Subjects", icon: BookOpen },
      ],
    },
    {
      id: "crm",
      label: "CRM",
      icon: UserCog,
      items: [],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      items: isSuperAdmin
        ? [
            { to: "/workspace/employees", label: "Employees", icon: Users },
            { to: "/workspace/instructors", label: "Instructors", icon: GraduationCap },
            { to: "/workspace/settings/sms-templates", label: "SMS Templates", icon: MessageSquareText },
            { to: "/workspace/settings/email-templates", label: "Email Templates", icon: Mail },
          ]
        : [
            { to: "/workspace/settings/sms-templates", label: "SMS Templates", icon: MessageSquareText },
            { to: "/workspace/settings/email-templates", label: "Email Templates", icon: Mail },

          ],
    },
  ];

  return (
    <InternalShell
      brand="Workspace"
      subtitle={isSuperAdmin ? "Super Admin Console" : "Employee Console"}
      groups={groups}
      profileTo="/workspace/profile"
    >
      <Outlet />
    </InternalShell>
  );
}
