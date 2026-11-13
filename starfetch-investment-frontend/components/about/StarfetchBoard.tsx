import { PeopleSection, type PeopleProfile } from "./PeopleSection";

/** Only approved Board records are rendered; no placeholder directors are shown. */
const boardMembers: PeopleProfile[] = [
  {
    name: "Toluwani Adeseri",
    role: "Co founder",
    image: "/images/toluwani-adeseri.png",
    alt: "Toluwani Adeseri, Co founder of Starfetch",
    position: "object-center",
    biography: "A strategic finance and investment leader who has built his career where capital markets meet balance-sheet discipline. He drives portfolio strategy, treasury and execution with the conviction that consistent, well-managed returns are the product of process, not chance — bringing rigour, discipline and a relentless client focus to every mandate. Track record spanning KPMG, Page Asset Management, Renaissance Capital, among others.",
    qualifications: ["CFA Charterholder", "ACA (ICAN)", "BSc Accounting", "Executive MBA"],
  },
];

export function StarfetchBoard() {
  return <PeopleSection id="starfetch-board" eyebrow="Leadership" title="Board of Directors" description="Experienced professionals providing leadership, investment expertise and strategic direction across Starfetch Investment Limited." people={boardMembers} />;
}
