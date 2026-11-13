import Image from "next/image";
import type { ReactNode } from "react";

export type PeopleProfile = {
  name: string;
  role: string;
  image: string;
  alt: string;
  biography?: string;
  qualifications?: string[];
  position?: string;
};

type PeopleSectionProps = {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  people: PeopleProfile[];
  afterProfiles?: ReactNode;
  showBiographies?: boolean;
};

/**
 * Shared Board and Leadership profile structure. It intentionally contains
 * only supplied Starfetch records: portrait, name, designation, approved bio
 * and supplied qualifications — never placeholder people or inferred details.
 */
export function PeopleSection({ id, eyebrow, title, description, people, afterProfiles, showBiographies = true }: PeopleSectionProps) {
  const headingId = `${id}-heading`;

  return <section id={id} className="border-t border-star-200 bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby={headingId}><div className="mx-auto max-w-[1100px] px-5 lg:px-7"><div className="max-w-3xl"><p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700"><span className="h-px w-7 bg-star-lime" aria-hidden="true" />{eyebrow}</p><h2 id={headingId} className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">{title}</h2><p className="mt-4 max-w-[43rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">{description}</p></div><div className="mt-10 grid gap-5 lg:grid-cols-2 lg:gap-6">{people.map((person) => <article key={person.name} className="flex h-full flex-col rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.035)] transition duration-200 hover:border-star-300 hover:shadow-[0_8px_22px_rgba(0,59,42,0.06)] sm:p-6"><div className="relative aspect-square w-full max-w-[250px] overflow-hidden rounded-lg border border-star-100 bg-star-50"><Image src={person.image} alt={person.alt} fill sizes="(max-width: 1023px) min(250px, calc(100vw - 5rem)), 250px" className={`object-cover ${person.position ?? "object-center"}`} /></div><div className="pt-5"><h3 className="font-display text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-star-900">{person.name}</h3><p className="mt-2 text-[0.71rem] font-extrabold uppercase tracking-[0.12em] text-star-700">{person.role}</p>{showBiographies && person.biography ? <p className="mt-4 text-sm leading-7 text-star-muted">{person.biography}</p> : null}{person.qualifications?.length ? <ul className="mt-5 flex flex-wrap gap-2" aria-label={`${person.name} professional qualifications`}>{person.qualifications.map((qualification) => <li key={qualification} className="rounded-full border border-star-200 bg-star-50 px-3 py-1 text-[0.69rem] font-bold leading-4 text-star-700">{qualification}</li>)}</ul> : null}</div></article>)}</div>{afterProfiles}</div></section>;
}
