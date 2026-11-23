import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ValueProposition } from "@/components/ValueProposition";
import { CompanyCredentials } from "@/components/CompanyCredentials";
import { WhoWeAre } from "@/components/WhoWeAre";
import { InvestmentServices } from "@/components/InvestmentServices";
import { OurValues } from "@/components/OurValues";
import { WhyStarfetch } from "@/components/WhyStarfetch";
import { FreeTools } from "@/components/FreeTools";
import { PersonalApproach } from "@/components/PersonalApproach";
import { FAQSection } from "@/components/FAQSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { MarketSection } from "@/components/MarketSection";
import { MarketTickerSection } from "@/components/MarketTickerSection";
import { MarketOverviewSkeleton } from "@/components/MarketOverviewSkeleton";
import { MarketTickerSkeleton } from "@/components/MarketTickerSkeleton";

/**
 * Revalidate the homepage on a short interval so the server-side market fetches
 * do not run on every request, while quotes stay reasonably current.
 */
export const revalidate = 120;

export default function Home() {
  /**
   * The page is intentionally SYNCHRONOUS.
   *
   * Market data is loaded by two server components, each behind its own
   * <Suspense> boundary. That is what makes a real loading state possible: a
   * boundary around a component whose data the page has already awaited never
   * shows its fallback, because React has nothing to suspend on. The navbar,
   * hero and every marketing section now render without waiting on any network
   * call, and the two feeds stream into their reserved space.
   */
  return (
    <>
      <Navbar />
      <Suspense fallback={<MarketTickerSkeleton />}>
        <MarketTickerSection />
      </Suspense>
      <main className="overflow-x-hidden">
        <HeroSection />
        <ValueProposition />
        <Reveal><CompanyCredentials /></Reveal>
        <Reveal><WhoWeAre /></Reveal>
        <Reveal><InvestmentServices /></Reveal>
        <OurValues />
        <Reveal><WhyStarfetch /></Reveal>
        <Suspense fallback={<MarketOverviewSkeleton />}>
          <Reveal>
            <MarketSection />
          </Reveal>
        </Suspense>
        <Reveal><FreeTools /></Reveal>
        <Reveal><PersonalApproach /></Reveal>
        <FAQSection />
        <Reveal><CTASection /></Reveal>
      </main>
      <Footer />
    </>
  );
}
