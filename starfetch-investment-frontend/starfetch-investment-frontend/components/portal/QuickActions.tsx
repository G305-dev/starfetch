import { quickActions } from "./dashboard-data";

export function QuickActions() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5" aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="text-lg font-extrabold text-star-900">Quick Actions</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            className="group flex min-h-12 items-center gap-2.5 rounded-lg border border-star-200 bg-star-50 px-3 text-sm font-bold text-star-700 no-underline transition hover:border-star-300 hover:bg-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-star-700 transition group-hover:bg-star-lime" aria-hidden="true">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span>{label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
