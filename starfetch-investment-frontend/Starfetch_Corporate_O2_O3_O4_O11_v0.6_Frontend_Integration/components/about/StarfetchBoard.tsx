import { PeopleSection, type PeopleProfile } from "./PeopleSection";

const boardMembers: PeopleProfile[] = [
  { name: "Toluwani Adeseri", role: "Co founder", image: "/images/executive-portrait-1.jpg", alt: "Toluwani Adeseri, Co founder of Starfetch", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-portrait-2.png", alt: "Professional portrait provided for the Starfetch Board section", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch Board member profile placeholder", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch Board member profile placeholder", position: "object-center" },
];

export function StarfetchBoard() {
  return <PeopleSection id="starfetch-board" eyebrow="Leadership" title="Board of Directors" description="Experienced professionals providing leadership, investment expertise and strategic direction across Starfetch Investment Limited." people={boardMembers} />;
}
