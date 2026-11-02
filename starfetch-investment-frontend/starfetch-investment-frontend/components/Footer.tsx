const exploreLinks = [
  { label: "About us", href: "https://starfetchinvestltd.com.ng/about" },
  { label: "Services", href: "https://starfetchinvestltd.com.ng/services" },
  { label: "Free tools", href: "https://starfetchinvestltd.com.ng/tools/" },
  { label: "Contact", href: "https://starfetchinvestltd.com.ng/contact" },
];

const legalLinks = [
  { label: "Privacy policy", href: "https://starfetchinvestltd.com.ng/privacy" },
  { label: "Complaints policy", href: "https://starfetchinvestltd.com.ng/complaints" },
];

export function Footer() {
  return (
    <footer id="contact" className="bg-star-900 text-star-100">
      <div className="mx-auto max-w-[1100px] px-5 pb-7 pt-10 lg:px-7">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-10">
          <div>
            <h2 className="text-sm font-bold text-white">Starfetch Investment Limited</h2>
            <p className="mt-3 max-w-sm text-[0.7rem] leading-5 text-star-100">The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria</p>
            <p className="mt-2 text-[0.7rem]"><a href="mailto:info@starfetchinvestltd.com.ng" className="text-star-100 no-underline transition hover:text-star-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime">info@starfetchinvestltd.com.ng</a></p>
          </div>
          <FooterLinkGroup heading="Explore" links={exploreLinks} />
          <FooterLinkGroup heading="Legal" links={legalLinks} />
        </div>

        <div className="mt-8 border-t border-white/20 pt-5 text-[0.61rem] leading-4 text-star-100">
          <p>RC 7402697 · Incorporated in Nigeria under CAMA 2020.</p>
          <p className="mt-2">Registered with the Securities and Exchange Commission, Nigeria as a Fund/Portfolio Manager.</p>
          <p className="mt-2 max-w-5xl">Investing involves risk, including the possible loss of principal. Past performance is not a reliable indicator of future results. Nothing on this website constitutes investment, legal or tax advice, an offer, or a solicitation to buy or sell any security.</p>
          <p id="market-data-notice" className="mt-2 max-w-5xl">Equity prices shown on our home page are supplied by TradingView, a licensed redistributor of Nigerian Exchange data. Prices may be delayed and are shown for information only — they are not an offer, a recommendation, or an indication of the performance of any Starfetch product.</p>
          <p className="mt-2">© 2026 Starfetch Investment Limited. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <section>
      <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white">{heading}</h2>
      <nav className="mt-3 grid gap-2" aria-label={`${heading} links`}>
        {links.map((link) => (
          <a key={link.label} href={link.href} className="w-fit text-[0.7rem] text-star-100 no-underline transition hover:text-star-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime">{link.label}</a>
        ))}
      </nav>
    </section>
  );
}
