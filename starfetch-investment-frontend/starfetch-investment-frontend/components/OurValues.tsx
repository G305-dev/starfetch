import { ourValues } from "./site-data";
import { Eyebrow } from "./ui";

export function OurValues() {
  return (
    <section className="bg-[#fffef9] py-16 sm:py-20 lg:py-[84px]">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-xl">
          <Eyebrow>Our approach</Eyebrow>
          <h2 className="mt-2 font-display text-[clamp(1.9rem,3.2vw,2.55rem)] font-bold leading-[1.08] tracking-[-0.035em] text-star-900">Our Values</h2>
          <p className="mt-3 text-sm leading-6 text-star-muted">The standards behind the way we serve clients, assess opportunities and manage capital.</p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          {ourValues.map((value) => (
            <article
              key={value.title}
              className="group relative min-h-[184px] overflow-hidden rounded-lg border border-star-200 bg-white p-6 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-star-300 hover:shadow-[0_6px_18px_rgba(0,59,42,0.06)] focus-within:-translate-y-0.5 focus-within:border-star-300 focus-within:shadow-[0_6px_18px_rgba(0,59,42,0.06)]"
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[5px] origin-left scale-x-0 bg-star-lime transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-within:scale-x-100" />
              <h3 className="text-[1.02rem] font-bold text-star-900">{value.title}</h3>
              <p className="mt-3 max-w-[31rem] text-sm leading-6 text-star-muted">{value.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
