"use client";

import { Building2, Check, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    description: "For two individuals who want to open and manage an investment account together.",
    href: "/register/joint",
    icon: Users,
  },
  {
    id: "corporate",
    title: "Corporate",
    description: "For companies, institutions and other eligible organisations opening an investment account.",
    href: "/register/corporate",
    icon: Building2,
  },
];

export function AccountTypeSelection() {
  const router = useRouter();
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType | null>(null);

  const selectedOption = accountTypes.find((accountType) => accountType.id === selectedAccountType) ?? null;

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
              onClick={() => setSelectedAccountType(id)}
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

      <button
        type="button"
        disabled={!selectedOption}
        onClick={() => selectedOption && router.push(selectedOption.href)}
        className="mt-8 inline-flex min-h-12 min-w-44 items-center justify-center rounded-lg bg-star-lime px-6 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-star-200 disabled:text-star-muted disabled:shadow-none disabled:hover:translate-y-0"
      >
        Continue
      </button>

      <p className="mt-5 text-xs leading-5 text-star-muted">
        By continuing, you agree to Starfetch&apos;s{" "}
        <a
          href="/terms-of-service"
          className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://starfetchinvestltd.com.ng/privacy"
          className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          Privacy Policy
        </a>.
      </p>
    </section>
  );
}
