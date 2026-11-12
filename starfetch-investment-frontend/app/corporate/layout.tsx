import { RequireInvestorAuth } from "@/components/auth/RequireIndividualAuth";

/** Corporate views require an authenticated backend session, not an Individual profile. */
export default function CorporateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RequireInvestorAuth>{children}</RequireInvestorAuth>;
}
