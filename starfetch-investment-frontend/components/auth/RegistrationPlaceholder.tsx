import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type RegistrationPlaceholderProps = {
  accountType: "Individual" | "Joint" | "Corporate";
  description: string;
};

export function RegistrationPlaceholder({ accountType, description }: RegistrationPlaceholderProps) {
  return (
    <main className="min-h-[calc(100vh-76px)] bg-star-50 px-5 py-16 sm:px-8 lg:py-24">
      <section className="mx-auto max-w-xl rounded-2xl border border-star-200 bg-white p-7 text-center shadow-card sm:p-10">
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Account opening</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-star-900">{accountType} Account</h1>
        <p className="mt-4 text-sm leading-6 text-star-muted">{description}</p>
        <p className="mt-4 rounded-lg bg-star-50 px-4 py-3 text-sm leading-6 text-star-700">
          This is the next frontend onboarding placeholder. No registration, KYC, document, funding, or account-creation data is collected here.
        </p>
        <Link
          href="/open-account"
          className="mt-7 inline-flex items-center gap-2 rounded-md border border-star-700 px-4 py-2.5 text-sm font-bold text-star-700 no-underline transition hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Choose a different account type
        </Link>
      </section>
    </main>
  );
}
