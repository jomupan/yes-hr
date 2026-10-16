import {
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Clock,
  Building2,
  Layers,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  group: "MAIN" | "LEAVE MANAGEMENT" | "EMPLOYEES" | "SYSTEM";
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
    group: "MAIN",
  },
  {
    id: "leave-requests",
    label: "Leave Requests",
    path: "/admin/leave-requests",
    icon: Inbox,
    group: "LEAVE MANAGEMENT",
  },
  {
    id: "leave-records",
    label: "Leave Records",
    path: "/admin/leave-records",
    icon: ClipboardList,
    group: "LEAVE MANAGEMENT",
  },
  {
    id: "leave-calendar",
    label: "Leave Calendar",
    path: "/admin/leave-calendar",
    icon: CalendarDays,
    group: "LEAVE MANAGEMENT",
  },
  {
    id: "employees",
    label: "Employee List",
    path: "/admin/employees",
    icon: Users,
    group: "EMPLOYEES",
  },
  {
    id: "attendance",
    label: "Attendance",
    path: "/admin/attendance",
    icon: Clock,
    group: "EMPLOYEES",
  },
  {
    id: "companies",
    label: "Companies",
    path: "/admin/companies",
    icon: Layers,
    group: "EMPLOYEES",
  },
  {
    id: "payslips",
    label: "Payslips",
    path: "/admin/payslips",
    icon: FileText,
    group: "EMPLOYEES",
  },
  {
    id: "departments",
    label: "Departments",
    path: "/admin/departments",
    icon: Building2,
    group: "EMPLOYEES",
  },
  {
    id: "reports",
    label: "Reports",
    path: "/admin/reports",
    icon: BarChart3,
    group: "SYSTEM",
  },
  {
    id: "notifications",
    label: "Notifications",
    path: "/admin/notifications",
    icon: Bell,
    group: "SYSTEM",
  },
  {
    id: "admins",
    label: "Admin Accounts",
    path: "/admin/admins",
    icon: ShieldCheck,
    group: "SYSTEM",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
    group: "SYSTEM",
  },
];

export const ADMIN_NAV_GROUPS: AdminNavItem["group"][] = [
  "MAIN",
  "LEAVE MANAGEMENT",
  "EMPLOYEES",
  "SYSTEM",
];

export const LOGOUT_ICON = LogOut;

export const YES_EMPIRE_LOGO =
  "https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp";
