import { BadgeCheck, FileText, MessagesSquare } from "lucide-react";

const propositions = [
  { icon: MessagesSquare, title: "Plain-language products" },
  { icon: BadgeCheck, title: "Fees disclosed upfront" },
  { icon: FileText, title: "Clear client reporting" },
];

export function ValueProposition() {
  return (
    <section className="bg-star-900 py-0 text-white">
      <div className="mx-auto grid max-w-7xl divide-y divide-white/15 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
        {propositions.map(({ icon: Icon, title }) => (
          <article key={title} className="flex items-center gap-4 py-6 sm:px-5 sm:py-8 lg:px-8">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-star-100 text-star-700" aria-hidden="true">
              <Icon size={22} strokeWidth={2.1} />
            </span>
            <h2 className="font-display text-lg font-bold text-white">{title}</h2>
          </article>
        ))}
      </div>
    </section>
  );
}
