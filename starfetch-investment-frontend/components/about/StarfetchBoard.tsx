import { PeopleSection, type PeopleProfile } from "./PeopleSection";

/** Only approved Board records are rendered; no placeholder directors are shown. */
const boardMembers: PeopleProfile[] = [
  {
    name: "Sylvia Igwe-Okparaeke",
    role: "Key Management — Legal, Governance, Risk & Compliance",
    image: "/images/sylvia-igwe-okparaeke.png",
    alt: "Sylvia Igwe-Okparaeke",
    position: "object-center",
    qualifications: ["LLB", "BL", "LLM", "CAMS", "ACIArb (UK)", "Executive MBA"],
  },
  {
    name: "Toluwani Adeseri",
    role: "Co founder",
    image: "/images/toluwani-adeseri.png",
    alt: "Toluwani Adeseri, Co founder of Starfetch",
    position: "object-center",
    qualifications: ["CFA Charterholder", "ACA (ICAN)", "BSc Accounting", "Executive MBA"],
  },
];

export function StarfetchBoard() {
  return <PeopleSection id="starfetch-board" eyebrow="Leadership" title="Board of Directors" description="Experienced professionals providing leadership, investment expertise and strategic direction across Starfetch Investment Limited." people={boardMembers} showBiographies={false} />;
}
