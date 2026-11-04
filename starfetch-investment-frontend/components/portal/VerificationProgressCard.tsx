import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";

export function VerificationProgressCard({ profileHref = "/profile" }: { profileHref?: string }) {
  return <section className="rounded-xl border border-star-200 bg-white p-5" aria-labelledby="profile-completion-heading"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-star-50 text-star-700"><UserRound size={20} aria-hidden="true" /></span><div><h2 id="profile-completion-heading" className="text-base font-extrabold text-star-900">Keep your profile up to date</h2><p className="mt-1 text-sm leading-5 text-star-muted">Review your personal details and provide any information requested for your account.</p><Link href={profileHref} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-star-300 px-3 text-sm font-bold text-star-700 no-underline transition hover:border-star-700 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete your profile <ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>;
}
