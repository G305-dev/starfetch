import { RequireIndividualAuth } from "@/components/auth/RequireIndividualAuth";

/** Corporate views require the existing authenticated Investor session. */
export default function CorporateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RequireIndividualAuth>{children}</RequireIndividualAuth>;
}
