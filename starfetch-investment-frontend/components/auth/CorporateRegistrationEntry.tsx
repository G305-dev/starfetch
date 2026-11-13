"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { CorporateApplicantRegistrationForm } from "./CorporateApplicantRegistrationForm";

/**
 * Corporate account-type selection is UI routing only. An unauthenticated
 * visitor creates and verifies a Corporate applicant login. An authenticated
 * applicant goes to the protected dashboard; O2 remains separately gated and
 * is not started automatically.
 */
export function CorporateRegistrationEntry() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/corporate/dashboard");
  }, [router, status]);

  if (status === "loading") return <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fffef9] px-5 text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Checking your secure session…</p></div></main>;
  if (status === "authenticated") return <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fffef9] px-5 text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Opening your Corporate applicant dashboard…</p></div></main>;
  return <main className="relative isolate min-h-[calc(100vh-76px)] overflow-hidden bg-[#fffef9] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"><div className="pointer-events-none absolute -left-32 top-12 -z-10 h-80 w-80 rounded-full bg-star-100/65 blur-3xl" aria-hidden="true" /><div className="pointer-events-none absolute -right-28 bottom-8 -z-10 h-96 w-96 rotate-12 border-[42px] border-star-100/80" aria-hidden="true" /><CorporateApplicantRegistrationForm /></main>;
}
