import { BadgeCheck, FileText, MessagesSquare } from "lucide-react";

const propositions = [
  { icon: MessagesSquare, title: "Plain-language products", text: "Straightforward explanations without jargon." },
  { icon: BadgeCheck, title: "Fees disclosed upfront", text: "Know what you’re paying before you invest." },
  { icon: FileText, title: "Clear client reporting", text: "Regular, easy-to-understand portfolio updates." },
];

export function ValueProposition() {
  return (
    <section className="bg-star-900 py-0 text-white">
      <div className="mx-auto grid max-w-7xl divide-y divide-white/15 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
        {propositions.map(({ icon: Icon, title, text }) => (
          <article key={title} className="flex gap-4 py-6 sm:px-5 sm:py-8 lg:px-8">
            <span className="feature-orbit-badge">
              <span className="feature-orbit-decoration" aria-hidden="true" />
              <span className="feature-orbit-center">
                <Icon size={22} strokeWidth={2.1} aria-hidden="true" />
              </span>
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-white">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-star-100">{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
