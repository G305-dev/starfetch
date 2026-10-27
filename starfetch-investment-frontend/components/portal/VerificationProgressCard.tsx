import { ArrowRight, CheckCircle2 } from "lucide-react";
import { accountVerification } from "./individual-dashboard-data";

export function VerificationProgressCard() {
  const progressStyle = { background: `conic-gradient(#B9ED1D 0 ${accountVerification.progress}%, #075038 ${accountVerification.progress}% 78%, #EDF6DE 78% 100%)` };

  return (
    <section className="rounded-xl border border-star-200 bg-[linear-gradient(135deg,#fffdf6_0%,#f7faed_100%)] p-5" aria-labelledby="verification-heading">
      <div className="flex items-start gap-4">
        <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full" style={progressStyle} aria-label={`${accountVerification.progress} percent verification progress`}>
          <span className="grid h-[59px] w-[59px] place-items-center rounded-full bg-white text-lg font-extrabold text-star-900">{accountVerification.progress}%</span>
        </div>
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-star-700"><CheckCircle2 size={15} aria-hidden="true" />{accountVerification.status}</p>
          <h2 id="verification-heading" className="mt-1 text-lg font-extrabold leading-6 text-star-900">{accountVerification.title}</h2>
          <p className="mt-2 text-sm leading-5 text-star-muted">{accountVerification.description}</p>
        </div>
      </div>
      <a href={accountVerification.href} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-star-lime px-4 text-sm font-extrabold text-star-900 no-underline transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete Your Setup <ArrowRight size={16} aria-hidden="true" /></a>
    </section>
  );
}
