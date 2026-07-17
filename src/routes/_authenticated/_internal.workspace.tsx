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
  UserPlus,
  AlertCircle,
  LayoutTemplate,
  FileText,
  Search,
  Globe,
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
  const { info, has } = useRole();
  const isSuperAdmin = info?.primaryRole === "super_admin";
  const canManageUsers = has("manage_users");

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
        { to: "/workspace/lms-and-courses/courses", label: "Courses", icon: GraduationCap },
      ],
    },
    {
      id: "crm",
      label: "CRM",
      icon: UserCog,
      items: canManageUsers
        ? [
            { to: "/workspace/crm/customers", label: "Customers", icon: Users },
            { to: "/workspace/crm/signed", label: "Signed · No purchase", icon: UserPlus },
            { to: "/workspace/crm/guests", label: "Guest purchases", icon: ShoppingBag },
            { to: "/workspace/crm/incomplete", label: "Incomplete leads", icon: AlertCircle },
          ]
        : [],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      items: canManageUsers
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
