export function DashboardGreeting({ firstName }: { firstName: string }) {
  return <section><h1 className="font-display text-[clamp(1.9rem,3.2vw,2.65rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">Good morning, {firstName} <span aria-hidden="true">👋</span></h1><p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Here&apos;s an overview of your investments and account activity.</p></section>;
}
