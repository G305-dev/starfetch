import Image from "next/image";

type Executive = {
  name: string;
  role: string;
  image: string;
  alt: string;
  position?: string;
};

const executives: Executive[] = [
  {
    name: "Adeseri Toluwani",
    role: "Managing Director, Starfetch",
    image: "/images/executive-portrait-1.jpg",
    alt: "Adeseri Toluwani, Managing Director of Starfetch",
    position: "object-center",
  },
  {
    name: "Name to be provided",
    role: "Role to be provided",
    image: "/images/executive-portrait-2.png",
    alt: "Unidentified professional portrait provided for the Starfetch leadership section",
    position: "object-center",
  },
  {
    name: "Name to be provided",
    role: "Role to be provided",
    image: "/images/executive-placeholder.svg",
    alt: "Neutral executive profile placeholder",
    position: "object-center",
  },
  {
    name: "Name to be provided",
    role: "Role to be provided",
    image: "/images/executive-placeholder.svg",
    alt: "Neutral executive profile placeholder",
    position: "object-center",
  },
];

export function ExecutiveManagement() {
  return (
    <section id="executive-management" className="border-t border-star-200 bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby="executive-management-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Leadership
          </p>
          <h2 id="executive-management-heading" className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">
            Group Executive Management
          </h2>
          <p className="mt-4 max-w-[43rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            Experienced professionals providing leadership, investment expertise and strategic direction across Starfetch Investment Limited.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {executives.map((executive, index) => (
            <article key={`${executive.name}-${index}`} className="group overflow-hidden rounded-[5px] border border-star-200 bg-white transition duration-200 ease-out hover:-translate-y-1 hover:border-star-300 hover:shadow-[0_7px_18px_rgba(0,59,42,0.06)]">
              <div className="relative aspect-[4/5] overflow-hidden bg-star-100">
                <Image
                  src={executive.image}
                  alt={executive.alt}
                  fill
                  sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 1279px) calc(50vw - 2.25rem), 260px"
                  className={`object-cover transition duration-300 ease-out group-hover:scale-[1.02] ${executive.position ?? "object-center"}`}
                />
              </div>
              <div className="relative p-5">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-star-lime transition-transform duration-200 ease-out group-hover:scale-x-100" />
                <h3 className="text-[0.88rem] font-bold uppercase tracking-[0.015em] text-star-900">{executive.name}</h3>
                <p className="mt-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-star-700">{executive.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
