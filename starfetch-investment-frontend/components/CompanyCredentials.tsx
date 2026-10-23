import { Building2, MapPin, ShieldCheck } from "lucide-react";

const credentials = [
  { icon: ShieldCheck, title: "SEC Nigeria registered", detail: "Fund/Portfolio Manager" },
  { icon: Building2, title: "RC 7402697", detail: "Incorporated in Nigeria" },
  { icon: MapPin, title: "Lekki, Lagos", detail: "Nigeria" },
];

export function CompanyCredentials() {
  return (
    <section id="about" className="border-y border-star-200 bg-white px-5 py-5 lg:px-7 lg:py-0">
      <div className="mx-auto grid max-w-[1100px] divide-y divide-star-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {credentials.map(({ icon: Icon, title, detail }) => (
          <div className="flex items-center justify-center gap-3 py-5 text-center sm:justify-start sm:px-7 sm:py-7 first:sm:pl-0" key={title}>
            <Icon size={22} strokeWidth={2} className="shrink-0 text-star-700" aria-hidden="true" />
            <div className="text-left">
              <p className="text-[0.72rem] font-bold uppercase tracking-[-0.01em] text-star-900">{title}</p>
              <p className="mt-0.5 text-[0.68rem] text-star-muted">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
