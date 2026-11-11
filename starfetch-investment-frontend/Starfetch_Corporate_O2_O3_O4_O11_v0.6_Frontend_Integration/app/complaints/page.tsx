import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Complaints Policy | Starfetch Investment Limited",
  description: "Learn how to submit a complaint to Starfetch Investment Limited, our complaint-handling procedures, response timelines and escalation options.",
};

const sections = [
  { id: "our-commitment", label: "1. Our commitment" },
  { id: "what-counts-as-a-complaint", label: "2. What counts as a complaint" },
  { id: "how-to-make-a-complaint", label: "3. How to make a complaint" },
  { id: "what-to-tell-us", label: "4. What to tell us" },
  { id: "what-we-will-do-and-how-quickly", label: "5. What we will do, and how quickly" },
  { id: "if-you-are-not-satisfied", label: "6. If you are not satisfied with our response" },
  { id: "our-complaints-register", label: "7. Our complaints register" },
  { id: "confidentiality", label: "8. Confidentiality" },
  { id: "ownership-and-review", label: "9. Ownership and review" },
];

const sectionHeadingClassName = "scroll-mt-24 font-display text-[1.25rem] font-bold leading-tight tracking-[-0.025em] text-star-900 sm:text-[1.4rem]";
const paragraphClassName = "text-[0.94rem] leading-7 text-star-muted sm:text-[0.98rem]";

export default function ComplaintsPolicyPage() {
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
            <h1 id="complaints-policy-title" className="mt-4 font-display text-[clamp(2.45rem,7vw,4.8rem)] font-bold leading-[0.98] tracking-[-0.06em] text-star-900">
              Complaints <em className="font-normal text-star-700">policy</em>
            </h1>
            <p className="mt-5 text-sm font-semibold text-star-700 sm:text-base">Effective 11 August 2026</p>
            <p className={`mt-7 max-w-3xl ${paragraphClassName}`}>
              Effective 11 August 2026. How to complain to Starfetch Investment Limited, what we will do, how long it will take, and how to escalate to the Securities and Exchange Commission if you are not satisfied. Published in line with the SEC Rules on the Complaints Management Framework of the Nigerian Capital Market.
            </p>
          </header>

          <div className="mt-9 grid gap-9 lg:mt-12 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
            <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Complaints Policy contents">
              <nav className="rounded-lg border border-star-200 bg-white p-5 shadow-[0_5px_16px_rgba(0,59,42,0.04)]" aria-label="Complaints Policy contents">
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
              <section aria-labelledby="our-commitment">
                <h2 id="our-commitment" className={sectionHeadingClassName}>1. Our commitment</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  If something we have done falls short, we want to hear about it directly and fix it. A complaint is not a nuisance to us — it is the fastest information we get about where our service is failing. Every complaint is investigated fairly, by someone not responsible for the matter complained about wherever that is possible, and no client is disadvantaged for having complained.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="what-counts-as-a-complaint">
                <h2 id="what-counts-as-a-complaint" className={sectionHeadingClassName}>2. What counts as a complaint</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  Any expression of dissatisfaction with our services, our people or our handling of your money or your instructions — whether about delays, errors, charges, communication, conduct, or the way a previous complaint was handled. You do not need to use the word &quot;complaint&quot; or any particular form of words.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="how-to-make-a-complaint">
                <h2 id="how-to-make-a-complaint" className={sectionHeadingClassName}>3. How to make a complaint</h2>
                <div className="mt-4 grid gap-5">
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">By email:</strong> <a href="mailto:info@starfetchinvestltd.com.ng?subject=Complaint" className="text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">info@starfetchinvestltd.com.ng</a>, with &quot;Complaint&quot; in the subject line. This is the fastest route and the one we recommend.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">By letter:</strong> The Compliance Officer, Starfetch Investment Limited, The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">In person:</strong> at the office address above, during business hours (Monday to Friday, 8:30am–5:30pm WAT).</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Through this website:</strong> using the contact form or the &quot;Leave a message&quot; widget on any page.</p>
                </div>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="what-to-tell-us">
                <h2 id="what-to-tell-us" className={sectionHeadingClassName}>4. What to tell us</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  So that we can investigate without going back and forth, please include where you can: your name and the account or reference the complaint relates to; what happened and when; who you dealt with; what you would like us to do to put it right; and copies of anything relevant. If you are complaining on behalf of someone else, please tell us your authority to do so.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="what-we-will-do-and-how-quickly">
                <h2 id="what-we-will-do-and-how-quickly" className={sectionHeadingClassName}>5. What we will do, and how quickly</h2>
                <div className="mt-5 grid gap-4">
                  <div className="border-l-4 border-star-lime bg-star-50 px-5 py-4 sm:px-6">
                    <p className={paragraphClassName}><strong className="font-bold text-star-900">Acknowledgement.</strong> We will acknowledge your complaint in writing within <strong className="font-bold text-star-900">two (2) working days</strong> of receiving it by email or through this website, and within <strong className="font-bold text-star-900">five (5) working days</strong> where you write to us by post. The acknowledgement will tell you who is handling the matter and how to reach them.</p>
                  </div>
                  <div className="border-l-4 border-star-lime bg-star-50 px-5 py-4 sm:px-6">
                    <p className={paragraphClassName}><strong className="font-bold text-star-900">Investigation and resolution.</strong> We aim to resolve your complaint and give you our written response within <strong className="font-bold text-star-900">ten (10) working days</strong> of receipt. If we need longer — for example because we must obtain records from a third party such as our custodian or bank — we will tell you why and give you a revised date.</p>
                  </div>
                  <div className="border-l-4 border-star-lime bg-star-50 px-5 py-4 sm:px-6">
                    <p className={paragraphClassName}><strong className="font-bold text-star-900">If we cannot resolve it in time.</strong> Where a complaint is not resolved within ten working days, we will notify the Securities and Exchange Commission within <strong className="font-bold text-star-900">two (2) working days</strong> of that deadline passing, setting out the action taken to date and providing the supporting documents, as the Commission&apos;s rules require.</p>
                  </div>
                </div>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="if-you-are-not-satisfied">
                <h2 id="if-you-are-not-satisfied" className={sectionHeadingClassName}>6. If you are not satisfied with our response</h2>
                <div className="mt-4 grid gap-5">
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">First, come back to us.</strong> Ask for the matter to be reviewed by our Compliance Officer, and then by the Managing Director. Say what part of our response you disagree with — a second look by a more senior person resolves most matters.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Then, the Commission.</strong> You may refer your complaint to the Securities and Exchange Commission, Nigeria, which operates a complaints management framework for the capital market. Details are available at <a href="https://sec.gov.ng/" className="text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">https://sec.gov.ng/</a>. You do not need our permission to do this and we will not treat you differently for doing it.</p>
                  <p className={paragraphClassName}><strong className="font-bold text-star-900">Finally, the Tribunal.</strong> Where a matter remains unresolved, it may be referred to the Investments and Securities Tribunal.</p>
                </div>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="our-complaints-register">
                <h2 id="our-complaints-register" className={sectionHeadingClassName}>7. Our complaints register</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  We maintain an electronic complaints register recording, for every complaint: a unique complaint number, the date received, the complainant, the nature and details of the complaint, the action taken, the date of resolution and the outcome. The register is reviewed by management, and we file the periodic returns on complaints that the Commission requires.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="confidentiality">
                <h2 id="confidentiality" className={sectionHeadingClassName}>8. Confidentiality</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  We handle your complaint confidentially. Information is shared only with those who need it to investigate and resolve the matter, or where we are required to disclose it to a regulator. Personal data is handled in line with our <Link href="/privacy" className="text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Privacy Policy</Link> and the Nigeria Data Protection Act 2023.
                </p>
              </section>

              <section className="mt-11 sm:mt-14" aria-labelledby="ownership-and-review">
                <h2 id="ownership-and-review" className={sectionHeadingClassName}>9. Ownership and review</h2>
                <p className={`mt-4 ${paragraphClassName}`}>
                  This policy is owned by the Compliance Officer of Starfetch Investment Limited and is reviewed at least annually, and whenever the applicable rules change. Complaints data is reported to the Board, because patterns in complaints are a governance matter, not only an operational one.
                </p>
                <div className="mt-7 border-l-4 border-star-lime bg-star-50 px-5 py-4 sm:px-6">
                  <p className="text-[0.78rem] leading-6 text-star-700 sm:text-sm">
                    Version 2026-08-11.v1 · Effective 11 August 2026 · Owner: Compliance Officer · Next scheduled review: August 2027
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
