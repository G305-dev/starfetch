import type { Metadata } from "next";
import { AboutCoreValues } from "@/components/about/AboutCoreValues";
import { StarfetchBoard } from "@/components/about/StarfetchBoard";
import { Team } from "@/components/about/Team";
import { AboutPhilosophy } from "@/components/about/AboutPhilosophy";
import { AboutVision } from "@/components/about/AboutVision";
import { WhoWeAreAbout } from "@/components/about/WhoWeAre";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "About Us | Starfetch Investment Limited",
  description: "Learn about Starfetch Investment Limited, a Lagos-based investment management company.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <WhoWeAreAbout />
        <AboutVision />
        <AboutPhilosophy />
        <AboutCoreValues />
        <StarfetchBoard />
        <Team />
      </main>
      <Footer />
    </>
  );
}
