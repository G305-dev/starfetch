import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Privacy Policy | Starfetch Investment Limited",
  description: "Read Starfetch Investment Limited's Privacy Policy, including how personal data is collected, processed, protected and retained.",
};

const sections = [
  { id: "who-we-are", label: "1. Who we are" },
  { id: "what-we-collect-and-why", label: "2. What we collect and why" },
  { id: "what-we-do-not-do", label: "3. What we do not do" },
  { id: "who-processes-your-data", label: "4. Who processes your data" },
  { id: "retention", label: "5. Retention" },
  { id: "your-rights", label: "6. Your rights" },
  { id: "security", label: "7. Security" },
  { id: "cookies-analytics-and-third-party-content", label: "8. Cookies, analytics and third-party content" },
  { id: "changes", label: "9. Changes" },
];

const sectionHeadingClassName = "scroll-mt-24 font-display text-[1.25rem] font-bold leading-tight tracking-[-0.025em] text-star-900 sm:text-[1.4rem]";
const paragraphClassName = "text-[0.94rem] leading-7 text-star-muted sm:text-[0.98rem]";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="bg-[#fffef9] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
          <header className="border-b border-star-200 pb-9 sm:pb-11">
            <p className="flex items-center gap-2 text-[0.63rem] font-bold uppercase tracking-[0.22em] text-star-700">
              <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
              Legal
            </p>
            <h1 id="privacy-policy-title" className="mt-4 font-display text-[clamp(2.45rem,7vw,4.8rem)] font-bold leading-[0.98] tracking-[-0.06em] text-star-900">
              Privacy <em className="font-normal text-star-700">policy</em>
            </h1>
            <p className="mt-5 text-sm font-semibold text-star-700 sm:text-base">Effective 12 August 2026</p>
            <p className={`mt-7 max-w-3xl ${paragraphClassName}`}>
              Effective 12 August 2026. This policy explains how Starfetch Investment Limited (&quot;Starfetch&quot;, &quot;we&quot;) collects and uses personal data, in line with the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection Regulation 2019 (NDPR).
            </p>
          </header>

          <div className="mt-9 grid gap-9 lg:mt-12 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
            <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Privacy Policy contents">
              <nav className="rounded-lg border border-star-200 bg-white p-5 shadow-[0_5px_16px_rgba(0,59,42,0.04)]" aria-label="Privacy Policy contents">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-star-700">On this page</p>
                <ol className="mt-3 grid gap-1.5">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block rounded px-2 py-1.5 text-[0.76rem] leading-5 text-star-muted no-underline transition hover:bg-star-50 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                      >
                        {section.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <article className="min-w-0">
              <section aria-labelledby="who-we-are">
                <h2 id="who-we-are" className={sectionHeadingClassName}>1. Who we are</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Starfetch Investment Limited · RC 7402697 · Incorporated in Nigeria under CAMA 2020. Our registered office is The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria. For any privacy matter, contact <a href="mailto:info@starfetchinvestltd.com.ng" className="text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">info@starfetchinvestltd.com.ng</a> (marked &quot;Data Protection&quot;).
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="what-we-collect-and-why">
                <h2 id="what-we-collect-and-why" className={sectionHeadingClassName}>2. What we collect and why</h2>
                <div className="mt-4 grid gap-5">
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Newsletter and free tools:</strong> your first name and email address, collected only with your explicit consent, to send you our newsletter and, where you request it, your tool results. We also record the consent text version, date/time and source so we can evidence your consent. Lawful basis: consent.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Enquiries:</strong> your name, email and message, used to respond to you. Lawful basis: consent and legitimate interest in responding to your request.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Clients and prospective clients:</strong> when onboarding opens, we will collect identity and verification data (including BVN/NIN) as required by law. Lawful basis: legal obligation (KYC/AML) and contract. A supplementary notice will be provided at onboarding.</p>
                </div>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="what-we-do-not-do">
                <h2 id="what-we-do-not-do" className={sectionHeadingClassName}>3. What we do not do</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  We do not sell personal data. We do not send marketing without recorded consent. We do not use your tool inputs (income, spending, investment figures) for any purpose other than showing you your results and, if you request it, emailing them to you.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="who-processes-your-data">
                <h2 id="who-processes-your-data" className={sectionHeadingClassName}>4. Who processes your data</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Trusted service providers process data on our instructions under data-processing agreements — website hosting, form handling and email delivery. Where any provider processes data outside Nigeria, we apply the NDPA&apos;s cross-border transfer requirements.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="retention">
                <h2 id="retention" className={sectionHeadingClassName}>5. Retention</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Newsletter data is kept until you unsubscribe or ask us to delete it. Enquiry data is kept for up to 24 months after our last exchange. Client records, once onboarding opens, follow statutory retention periods under SEC and AML rules.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="your-rights">
                <h2 id="your-rights" className={sectionHeadingClassName}>6. Your rights</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Under the NDPA you may access, correct, delete, or receive a copy of your personal data, restrict or object to processing, and withdraw consent at any time (every marketing email includes an unsubscribe link; or email us). You may also complain to the Nigeria Data Protection Commission (NDPC).
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="security">
                <h2 id="security" className={sectionHeadingClassName}>7. Security</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Data is transmitted over encrypted connections (HTTPS) and access is restricted to authorised personnel. If a breach is likely to result in risk to you, we will notify the NDPC within 72 hours and affected individuals without undue delay, as the NDPA requires.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="cookies-analytics-and-third-party-content">
                <h2 id="cookies-analytics-and-third-party-content" className={sectionHeadingClassName}>8. Cookies, analytics and third-party content</h2>
                <div className="mt-4 grid gap-5">
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Starfetch sets no cookies of its own.</strong> We do not run advertising or analytics on this website and we place no tracking cookies. If we introduce analytics we will use a privacy-respecting configuration and update this policy first.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Third-party content on our homepage.</strong> Two features on our home page load content from outside our systems, and we would rather tell you plainly than bury it.</p>
                  <p className={paragraphClassName}>The <strong className="font-bold text-star-900">Nigerian equity price ticker</strong> at the top of the page is supplied by TradingView, which is licensed to redistribute Nigerian Exchange data. Their widget loads from TradingView&apos;s servers, so your browser connects directly to them: your IP address, browser type and the page you are viewing are visible to TradingView, and the widget may set TradingView&apos;s own cookies - including analytics and advertising cookies - under TradingView&apos;s cookie policy rather than ours. We receive none of that data, and nothing you give us is shared with them. If you block third-party cookies in your browser, the rest of this website works normally.</p>
                  <p className={paragraphClassName}>The <strong className="font-bold text-star-900">market headlines</strong> are retrieved through a third-party feed service, which likewise sees your IP address and browser type when the page loads. We are moving that feed onto our own systems.</p>
                  <p className={paragraphClassName}>Everything else on this website - including the policy figures we publish - is served entirely by us. These third-party features appear on the home page only; the rest of the site loads nothing from outside our own systems.</p>
                </div>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="changes">
                <h2 id="changes" className={sectionHeadingClassName}>9. Changes</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  We will post any changes here with a new version number and effective date. Consent records stored by Starfetch reference the version of this policy and of the consent wording that applied when consent was given, so you can always establish what you agreed to and when.
                </p>
                <div className="mt-7 border-l-4 border-star-lime bg-star-50 px-5 py-4 sm:px-6">
                  <p className="text-[0.78rem] leading-6 text-star-700 sm:text-sm">
                    Version 2026-08-12.v5 · Effective 12 August 2026 · Supersedes versions 2026-08-12.v4, 2026-08-12.v3, 2026-08-11.v2 and 2026-07-14.v1 · Owner: Compliance Officer / Data Protection Officer · Next scheduled review: August 2027
                  </p>
                </div>
              </section>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
