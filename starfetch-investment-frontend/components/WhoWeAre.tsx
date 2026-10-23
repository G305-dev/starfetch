import { Diamond } from "lucide-react";
import { whoWeArePoints } from "./site-data";
import { Button } from "./ui";

export function WhoWeAre() {
  return (
    <section id="who-we-are" className="bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby="who-we-are-heading">
      <div className="mx-auto grid max-w-[1100px] items-center gap-9 px-5 md:grid-cols-2 md:gap-10 lg:gap-14 lg:px-7">
        <div className="max-w-[32rem]">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Who we are
          </p>
          <h2 id="who-we-are-heading" className="mt-4 font-display text-[clamp(2rem,3.15vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.04em] text-star-900">
            An investment partner you can actually talk to.
          </h2>
          <p className="mt-5 max-w-[31rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            We are a Lagos-based, SEC-registered asset manager built around a simple idea: institutional discipline should not come with institutional distance. Here is what that means in practice:
          </p>
          <Button href="#contact" variant="outline" className="mt-7 rounded-[5px] bg-white px-5 py-3 text-[0.8rem]">
            Learn more about us
          </Button>
        </div>

        <aside className="rounded-xl bg-star-900 p-6 text-white sm:p-8 lg:p-9" aria-labelledby="in-practice-heading">
          <h3 id="in-practice-heading" className="font-display text-[1.18rem] font-bold tracking-[-0.025em] text-white sm:text-[1.28rem]">
            In practice, that means
          </h3>
          <ul className="mt-5 divide-y divide-white/15">
            {whoWeArePoints.map((point) => (
              <li key={point.title} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <Diamond size={12} fill="currentColor" strokeWidth={1.5} className="mt-1.5 shrink-0 text-star-lime" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-bold text-white">{point.title}</h4>
                  {point.description ? <p className="mt-1 text-sm leading-6 text-star-100">{point.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
