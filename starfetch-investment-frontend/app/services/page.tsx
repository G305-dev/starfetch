import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ServiceDetailSection } from "@/components/services/ServiceDetailSection";
import { ServicesCTA } from "@/components/services/ServicesCTA";
import { ServicesIntro } from "@/components/services/ServicesIntro";
import { serviceDetails } from "@/components/services/services-data";

export const metadata: Metadata = {
  title: "Investment Services | Starfetch Investment Limited",
  description: "Explore Starfetch fixed-income, discretionary portfolio and market-execution investment solutions.",
};

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main>
        <ServicesIntro />
        {serviceDetails.map((service) => <ServiceDetailSection key={service.id} service={service} />)}
        <ServicesCTA />
      </main>
      <Footer />
    </>
  );
}
