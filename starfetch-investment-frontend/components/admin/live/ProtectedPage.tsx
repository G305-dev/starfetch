import { redirect } from "next/navigation";
import { getSession, liveConfig } from "@/lib/admin-api/server";
import type { Permission } from "@/lib/admin-api/contracts";
import { AdminShell } from "@/components/admin/AdminShell";
import { AlertTriangle } from "lucide-react";

/**
 * PROTECTED PAGE — session-verified wrapper, optionally permission-gated.
 *
 * `permission` is optional and its absence is deliberate, not an oversight.
 *
 * A staff member's own second factor is a property of their *account*, not of a
 * portal section. Gating it behind `staff.read` — the permission that governs
 * viewing *other* staff — meant a staff member without that permission could not
 * enrol MFA, could not see their recovery-code count, and could not reauthenticate.
 * That is a security defect: the people most in need of securing their account
 * were the ones unable to reach the controls.
 *
 * Omitting `permission` still requires a verified staff session. This is not an
 * open page; it is a page that asks "are you staff?" rather than "may you
 * administer staff?".
 */
export async function ProtectedPage({
  permission,
  children,
}: {
  permission?: Permission;
  children: React.ReactNode;
}) {
  if (!liveConfig())
    return (
      <div className="mx-auto mt-24 max-w-xl rounded-xl border border-amber-200 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 text-amber-700" />
        <h1 className="text-xl font-bold text-star-900">Admin integration unavailable</h1>
        <p className="mt-3 text-sm text-star-muted">
          Secure staff authentication and backend integration have not yet been approved. No records are displayed.
        </p>
      </div>
    );

  const session = await getSession();
  if (!session) redirect("/admin/login");

  // Only enforced when a permission was named. The backend re-checks every
  // request regardless; this controls what is rendered, never what is allowed.
  if (permission && !session.permissions.includes(permission))
    return (
      <div className="mx-auto mt-24 max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="mt-3 text-sm">Your staff account is not authorized to view this section.</p>
      </div>
    );

  return <AdminShell session={session}>{children}</AdminShell>;
}
