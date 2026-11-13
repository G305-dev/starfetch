import Image from "next/image";
import { PeopleSection, type PeopleProfile } from "./PeopleSection";

const teamMembers: PeopleProfile[] = [
  {
    name: "Sylvia Igwe-Okparaeke",
    role: "Key Management — Legal, Governance, Risk & Compliance",
    image: "/images/sylvia-igwe-okparaeke.png",
    alt: "Sylvia Igwe-Okparaeke",
    position: "object-center",
    biography: "A senior executive who sits at the intersection of investment strategy and regulatory discipline. She builds the institutional resilience and investor confidence that let firms scale with credibility, grounded in a firm belief that in this industry, how you get there matters as much as the returns. Track record spanning United Capital, ARM, the Nigerian Exchange, and Page Asset Management.",
    qualifications: ["LLB", "BL", "LLM", "CAMS", "ACIArb (UK)", "Executive MBA"],
  },
  {
    name: "Toluwani Adeseri",
    role: "Key Management — Investments, Strategy & Finance",
    image: "/images/toluwani-adeseri.png",
    alt: "Toluwani Adeseri",
    position: "object-center",
    biography: "A strategic finance and investment leader who has built his career where capital markets meet balance-sheet discipline. He drives portfolio strategy, treasury and execution with the conviction that consistent, well-managed returns are the product of process, not chance — bringing rigour, discipline and a relentless client focus to every mandate. Track record spanning KPMG, Page Asset Management, Renaissance Capital, among others.",
    qualifications: ["CFA Charterholder", "ACA (ICAN)", "BSc Accounting", "Executive MBA"],
  },
];

const institutions = [
  { name: "Page Asset Management", image: "/images/institution-page.png" },
  { name: "United Capital", image: "/images/institution-united-capital.png" },
  { name: "ARM", image: "/images/institution-arm.png" },
  { name: "Nigerian Exchange", image: "/images/institution-ngx.png" },
  { name: "KPMG", image: "/images/institution-kpmg.png" },
  { name: "Renaissance Capital", image: "/images/institution-renaissance-capital.png" },
  { name: "renmoney", image: "/images/institution-renmoney.png" },
  { name: "Accelerex", image: "/images/institution-accelerex.png" },
  { name: "Aipec Group", image: "/images/institution-aipec.png" },
  { name: "ACA", image: "/images/institution-aca.png" },
];

function Institutions() {
  return <section className="mt-14 border-t border-star-200 pt-10 sm:mt-16" aria-labelledby="leading-institutions-heading"><p id="leading-institutions-heading" className="text-[0.68rem] font-extrabold uppercase tracking-[0.19em] text-star-700">Careers built at leading institutions</p><div className="mt-5 grid max-w-[920px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{institutions.map((institution) => <div key={institution.name} className="flex h-[58px] items-center justify-center overflow-hidden rounded-md bg-white"><Image src={institution.image} alt={institution.name} width={161} height={63} className="max-h-10 w-auto max-w-[125px] object-contain" /></div>)}</div></section>;
}

export function Team() {
  return <PeopleSection id="team" eyebrow="Leadership" title={<>Led by industry <em className="font-serif font-normal text-star-limeDark">trailblazers</em> and experienced professionals</>} description="Two key management team members who have built and led investment businesses at the highest level. They pair complementary strengths across investments, finance, governance and risk." people={teamMembers} afterProfiles={<Institutions />} />;
}
