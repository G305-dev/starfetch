import { BadgeCheck, ChartPie, Headphones, ShieldAlert } from "lucide-react";
import { SectionHeading } from "./ui";

const features = [
  { icon: BadgeCheck, title: "Transparent mandates", text: "Clear objectives, process and reporting." },
  { icon: ShieldAlert, title: "Risk explained", text: "Understand the risks before you invest." },
  { icon: ChartPie, title: "Portfolio updates", text: "Regular, easy-to-read reporting." },
  { icon: Headphones, title: "Speak with an adviser", text: "Get expert guidance when you need it." },
];

export function WhyStarfetch() {
  return (
    <section className="bg-star-50 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <SectionHeading
          eyebrow="Why choose Starfetch"
          title="Everything you need to invest with clarity"
          description="We believe every investor deserves clear information, measured advice and a relationship built for the long term."
          centered
        />
        <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-lg border border-star-200 bg-white p-6 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-star-300 hover:shadow-[0_6px_18px_rgba(0,59,42,0.06)] focus-within:-translate-y-0.5 focus-within:border-star-300 focus-within:shadow-[0_6px_18px_rgba(0,59,42,0.06)]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-star-100 text-star-700"><Icon size={20} aria-hidden="true" /></span>
              <h3 className="mt-5 text-[1rem] font-bold text-star-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-star-muted">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
