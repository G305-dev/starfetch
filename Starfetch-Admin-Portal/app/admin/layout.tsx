import { AdminShell } from "@/components/admin/AdminShell";

// Development-only shell: staff/admin authorization must be enforced by the backend later.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
