import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const page = readFileSync(join(root, "app/complaints/page.tsx"), "utf8");
const footer = readFileSync(join(root, "components/Footer.tsx"), "utf8");

function plainSource(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

const content = plainSource(page);
const requiredPolicyText = [
  "Effective 11 August 2026. How to complain to Starfetch Investment Limited, what we will do, how long it will take, and how to escalate to the Securities and Exchange Commission if you are not satisfied. Published in line with the SEC Rules on the Complaints Management Framework of the Nigerian Capital Market.",
  "If something we have done falls short, we want to hear about it directly and fix it. A complaint is not a nuisance to us — it is the fastest information we get about where our service is failing. Every complaint is investigated fairly, by someone not responsible for the matter complained about wherever that is possible, and no client is disadvantaged for having complained.",
  'Any expression of dissatisfaction with our services, our people or our handling of your money or your instructions — whether about delays, errors, charges, communication, conduct, or the way a previous complaint was handled. You do not need to use the word "complaint" or any particular form of words.',
  'By email: info@starfetchinvestltd.com.ng, with "Complaint" in the subject line. This is the fastest route and the one we recommend.',
  "By letter: The Compliance Officer, Starfetch Investment Limited, The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria.",
  "In person: at the office address above, during business hours (Monday to Friday, 8:30am–5:30pm WAT).",
  'Through this website: using the contact form or the "Leave a message" widget on any page.',
  "So that we can investigate without going back and forth, please include where you can: your name and the account or reference the complaint relates to; what happened and when; who you dealt with; what you would like us to do to put it right; and copies of anything relevant. If you are complaining on behalf of someone else, please tell us your authority to do so.",
  "Acknowledgement. We will acknowledge your complaint in writing within two (2) working days of receiving it by email or through this website, and within five (5) working days where you write to us by post. The acknowledgement will tell you who is handling the matter and how to reach them.",
  "Investigation and resolution. We aim to resolve your complaint and give you our written response within ten (10) working days of receipt. If we need longer — for example because we must obtain records from a third party such as our custodian or bank — we will tell you why and give you a revised date.",
  "If we cannot resolve it in time. Where a complaint is not resolved within ten working days, we will notify the Securities and Exchange Commission within two (2) working days of that deadline passing, setting out the action taken to date and providing the supporting documents, as the Commission's rules require.",
  "First, come back to us. Ask for the matter to be reviewed by our Compliance Officer, and then by the Managing Director. Say what part of our response you disagree with — a second look by a more senior person resolves most matters.",
  "Then, the Commission. You may refer your complaint to the Securities and Exchange Commission, Nigeria, which operates a complaints management framework for the capital market. Details are available at https://sec.gov.ng/. You do not need our permission to do this and we will not treat you differently for doing it.",
  "Finally, the Tribunal. Where a matter remains unresolved, it may be referred to the Investments and Securities Tribunal.",
  "We maintain an electronic complaints register recording, for every complaint: a unique complaint number, the date received, the complainant, the nature and details of the complaint, the action taken, the date of resolution and the outcome. The register is reviewed by management, and we file the periodic returns on complaints that the Commission requires.",
  "We handle your complaint confidentially. Information is shared only with those who need it to investigate and resolve the matter, or where we are required to disclose it to a regulator. Personal data is handled in line with our Privacy Policy and the Nigeria Data Protection Act 2023.",
  "This policy is owned by the Compliance Officer of Starfetch Investment Limited and is reviewed at least annually, and whenever the applicable rules change. Complaints data is reported to the Board, because patterns in complaints are a governance matter, not only an operational one.",
  "Version 2026-08-11.v1 · Effective 11 August 2026 · Owner: Compliance Officer · Next scheduled review: August 2027",
];

for (const text of requiredPolicyText) {
  if (!content.includes(text)) throw new Error(`Complaints policy text is missing or changed: ${text.slice(0, 72)}…`);
}

for (const heading of [
  "1. Our commitment",
  "2. What counts as a complaint",
  "3. How to make a complaint",
  "4. What to tell us",
  "5. What we will do, and how quickly",
  "6. If you are not satisfied with our response",
  "7. Our complaints register",
  "8. Confidentiality",
  "9. Ownership and review",
]) {
  if (!page.includes(`>${heading}</h2>`)) throw new Error(`Complaints policy section heading is missing or not an H2: ${heading}`);
}

if (!page.includes('title: "Complaints Policy | Starfetch Investment Limited"')) throw new Error("Complaints metadata title is missing or changed");
if (!page.includes("description: \"Learn how to submit a complaint to Starfetch Investment Limited, our complaint-handling procedures, response timelines and escalation options.\"")) throw new Error("Complaints metadata description is missing or changed");
if (!page.includes('href="mailto:info@starfetchinvestltd.com.ng?subject=Complaint"')) throw new Error("Complaints email link is missing or has the wrong subject");
if (!page.includes('href="https://sec.gov.ng/"')) throw new Error("SEC external link is missing");
if (!page.includes('<Link href="/privacy"')) throw new Error("Internal Privacy Policy link is missing");
if (!page.includes("<Navbar />") || !page.includes("<Footer />")) throw new Error("Complaints page must include the shared Navbar and Footer");
if (!footer.includes('{ label: "Complaints policy", href: "/complaints" }')) throw new Error("Footer Complaints policy must point to /complaints");
if (getSafeReturnPath("/complaints") !== "/complaints") throw new Error("Complaints route is not a safe internal destination");

console.log("PASS — Complaints page preserves the supplied policy paragraphs, nine H2 sections, metadata, links, shared navigation, response timelines, and version history");
