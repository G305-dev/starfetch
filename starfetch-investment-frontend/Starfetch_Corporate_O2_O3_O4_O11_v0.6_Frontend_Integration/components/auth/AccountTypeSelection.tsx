"use client";

import { Building2, Check, LogIn, UserPlus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getJointRegistrationEntryAction, INDIVIDUAL_REGISTRATION_HREF, JOINT_REGISTRATION_SIGN_IN_HREF } from "@/lib/auth/joint-registration-entry";
import { useAuth } from "./AuthProvider";

type AccountType = "individual" | "joint" | "corporate";

type AccountTypeOption = {
  id: AccountType;
  title: string;
  description: string;
  href: string;
  icon: typeof UserRound;
};

const accountTypes: AccountTypeOption[] = [
  {
    id: "individual",
    title: "Individual",
    description: "For a single investor opening and managing an investment account in their own name.",
    href: "/register/individual",
    icon: UserRound,
  },
  {
    id: "joint",
    title: "Joint",
    description: "For a verified Starfetch investor to invite a second holder to a Joint Account.",
    href: "/register/joint",
    icon: Users,
  },
  {
    id: "corporate",
    title: "Business",
    description: "For businesses, institutions and other eligible organisations opening an investment account.",
    href: "/register/corporate",
    icon: Building2,
  },
];

export function AccountTypeSelection() {
  const router = useRouter();
  const { status } = useAuth();
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType | null>(null);
  const [showJointAccessExplanation, setShowJointAccessExplanation] = useState(false);

  const selectedOption = accountTypes.find((accountType) => accountType.id === selectedAccountType) ?? null;
  const jointRegistrationAction = getJointRegistrationEntryAction(status);
  const checkingJointSession = selectedOption?.id === "joint" && jointRegistrationAction === "wait";

  function selectAccountType(type: AccountType) {
    setSelectedAccountType(type);
    setShowJointAccessExplanation(false);
  }

  function continueToSelectedAccount() {
    if (!selectedOption) return;
    if (selectedOption.id !== "joint") {
      router.push(selectedOption.href);
      return;
    }
    if (jointRegistrationAction === "continue") {
      router.push("/register/joint");
      return;
    }
    if (jointRegistrationAction === "explain") setShowJointAccessExplanation(true);
  }

  return (
    <section className="mx-auto w-full max-w-[1050px] text-center">
      <p className="text-[0.67rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Get started</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.045em] text-star-900">
        Choose your account type
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted sm:text-[0.96rem]">
        Select the type of account you would like to open with Starfetch.
      </p>

      <div className="mx-auto mt-6 w-full max-w-[210px]" aria-label="Step 1 of 4">
        <p className="text-xs font-bold text-star-700">Step 1 of 4</p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <span key={step} className={`h-1.5 rounded-full ${step === 0 ? "w-8 bg-star-lime" : "w-1.5 bg-star-200"}`} />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 text-left md:grid-cols-2 lg:grid-cols-3">
        {accountTypes.map(({ id, title, description, icon: Icon }) => {
          const isSelected = selectedAccountType === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectAccountType(id)}
              aria-pressed={isSelected}
              className={`group relative flex min-h-[236px] w-full flex-col rounded-2xl border p-6 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:p-7 ${
                isSelected
                  ? "border-star-lime bg-star-100 shadow-[0_10px_24px_rgba(0,59,42,0.09)]"
                  : "border-star-200 bg-white hover:-translate-y-0.5 hover:border-star-300 hover:shadow-card"
              }`}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-xl transition-colors ${isSelected ? "bg-star-lime text-star-900" : "bg-star-100 text-star-700 group-hover:bg-star-lime"}`}>
                <Icon size={25} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <h2 className="mt-6 text-lg font-extrabold text-star-900">{title}</h2>
              <p className="mt-2 max-w-[18rem] text-sm leading-6 text-star-muted">{description}</p>
              <span
                className={`absolute right-5 top-5 grid h-6 w-6 place-items-center rounded-full border transition sm:right-6 sm:top-6 ${
                  isSelected ? "border-star-700 bg-star-700 text-white" : "border-star-200 bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="sr-only">{isSelected ? `${title} account selected` : `Select ${title} account`}</span>
            </button>
          );
        })}
      </div>

      {showJointAccessExplanation ? (
        <section aria-labelledby="joint-access-heading" className="mx-auto mt-8 max-w-3xl rounded-2xl border border-star-200 bg-white p-6 text-left shadow-card sm:p-8">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-star-100 text-star-700"><Users size={25} aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-star-700">Joint investor account</p>
              <h2 id="joint-access-heading" className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-star-900 sm:text-3xl">Opening a Joint Investment Account</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">To open a Joint Investment Account, you must first register or sign in as a verified Starfetch Investor.</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Once your account is verified, you can invite a second account holder to join your Joint Investment Account.</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={JOINT_REGISTRATION_SIGN_IN_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><LogIn size={18} aria-hidden="true" />Sign In</Link>
            <Link href={INDIVIDUAL_REGISTRATION_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-star-300 bg-white px-5 text-sm font-extrabold text-star-700 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><UserPlus size={18} aria-hidden="true" />Create an Individual Account</Link>
          </div>
          <button type="button" onClick={() => setShowJointAccessExplanation(false)} className="mt-5 text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-4 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Back to account options</button>
        </section>
      ) : (
        <button
          type="button"
          disabled={!selectedOption || checkingJointSession}
          onClick={continueToSelectedAccount}
          className="mt-8 inline-flex min-h-12 min-w-44 items-center justify-center rounded-lg bg-star-lime px-6 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-star-200 disabled:text-star-muted disabled:shadow-none disabled:hover:translate-y-0"
        >
          {checkingJointSession ? "Checking secure session…" : "Continue"}
        </button>
      )}

      <p className="mt-5 text-xs leading-5 text-star-muted">
        By continuing, you agree to Starfetch&apos;s{" "}
        <a
          href="/terms-of-service"
          className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          Privacy Policy
        </Link>.
      </p>
    </section>
  );
}
