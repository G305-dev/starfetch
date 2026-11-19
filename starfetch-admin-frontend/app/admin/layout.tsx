import { AdminShell } from "@/components/admin/AdminShell";

// Preview shell only: real staff authorization must be enforced by the backend later.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
