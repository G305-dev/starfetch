import { RequireAccountContext } from "@/components/auth/RequireIndividualAuth";

/**
 * Corporate views require an authenticated session whose backend projection
 * proves CORPORATE context. Individual or Joint-only accounts get an access
 * notice instead of portal content.
 */
export default function CorporateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RequireAccountContext context="CORPORATE">{children}</RequireAccountContext>;
}
