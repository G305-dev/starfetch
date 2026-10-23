import { Navbar } from "@/components/Navbar";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroSection } from "@/components/HeroSection";
import { ValueProposition } from "@/components/ValueProposition";
import { CompanyCredentials } from "@/components/CompanyCredentials";
import { WhoWeAre } from "@/components/WhoWeAre";
import { InvestmentServices } from "@/components/InvestmentServices";
import { OurValues } from "@/components/OurValues";
import { WhyStarfetch } from "@/components/WhyStarfetch";
import { MarketOverview } from "@/components/MarketOverview";
import { FreeTools } from "@/components/FreeTools";
import { PersonalApproach } from "@/components/PersonalApproach";
import { FAQSection } from "@/components/FAQSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <MarketTicker />
        <HeroSection />
        <ValueProposition />
        <Reveal><CompanyCredentials /></Reveal>
        <Reveal><WhoWeAre /></Reveal>
        <Reveal><InvestmentServices /></Reveal>
        <OurValues />
        <Reveal><WhyStarfetch /></Reveal>
        <Reveal><MarketOverview /></Reveal>
        <Reveal><FreeTools /></Reveal>
        <Reveal><PersonalApproach /></Reveal>
        <FAQSection />
        <Reveal><CTASection /></Reveal>
      </main>
      <Footer />
    </>
  );
}
