import Image from "next/image";

export type PeopleProfile = {
  name: string;
  role: string;
  image: string;
  alt: string;
  position?: string;
};

type PeopleSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  people: PeopleProfile[];
};

/** Shared visual structure for the Starfetch Board and Team sections. */
export function PeopleSection({ id, eyebrow, title, description, people }: PeopleSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} className="border-t border-star-200 bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby={headingId}>
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700"><span className="h-px w-7 bg-star-lime" aria-hidden="true" />{eyebrow}</p>
          <h2 id={headingId} className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">{title}</h2>
          <p className="mt-4 max-w-[43rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">{description}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {people.map((person, index) => (
            <article key={`${person.name}-${index}`} className="group overflow-hidden rounded-[5px] border border-star-200 bg-white transition duration-200 ease-out hover:-translate-y-1 hover:border-star-300 hover:shadow-[0_7px_18px_rgba(0,59,42,0.06)]">
              <div className="relative aspect-[4/5] overflow-hidden bg-star-100">
                <Image src={person.image} alt={person.alt} fill sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 1279px) calc(50vw - 2.25rem), 260px" className={`object-cover transition duration-300 ease-out group-hover:scale-[1.02] ${person.position ?? "object-center"}`} />
              </div>
              <div className="relative p-5"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-star-lime transition-transform duration-200 ease-out group-hover:scale-x-100" /><h3 className="text-[0.88rem] font-bold tracking-[0.015em] text-star-900">{person.name}</h3><p className="mt-2 text-[0.76rem] font-bold tracking-[0.02em] text-star-700">{person.role}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
