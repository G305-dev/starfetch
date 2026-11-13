import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CorporateApplicationState } from "../lib/corporate/application";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const peopleSection = read("components/about/PeopleSection.tsx");
const board = read("components/about/StarfetchBoard.tsx");
const team = read("components/about/Team.tsx");
const about = read("app/about/page.tsx");

assert(peopleSection.includes('import Image from "next/image"') && peopleSection.includes("lg:grid-cols-2") && !peopleSection.includes("xl:grid-cols-4"), "Profile cards must use Next Image and two equal desktop columns rather than the old four-column layout");
assert(peopleSection.indexOf("<Image") < peopleSection.indexOf("<h3") && peopleSection.includes("person.biography") && peopleSection.includes("person.qualifications"), "A card must place the portrait before name/designation and render biography/qualifications");
assert(peopleSection.includes("grid gap-5 lg:grid-cols-2") && peopleSection.includes("aspect-square") && peopleSection.includes("rounded-xl border border-star-200 bg-white"), "The vertical cards must retain responsive single-column mobile behaviour and the new white/bordered visual treatment");

for (const required of [
  "Sylvia Igwe-Okparaeke",
  "Key Management — Legal, Governance, Risk & Compliance",
  "A senior executive who sits at the intersection of investment strategy and regulatory discipline.",
  "LLB",
  "ACIArb (UK)",
  "Toluwani Adeseri",
  "Key Management — Investments, Strategy & Finance",
  "A strategic finance and investment leader who has built his career where capital markets meet balance-sheet discipline.",
  "CFA Charterholder",
  "Led by industry",
  "trailblazers",
  "Two key management team members who have built and led investment businesses at the highest level.",
  "Careers built at leading institutions",
]) assert(team.includes(required), `Approved Leadership content is missing: ${required}`);

assert(team.includes("max-w-[920px]") && team.includes("h-[58px]") && team.includes("max-w-[125px]") && !team.includes("The management team is supported by an experienced and professional advisory board."), "Institution tiles must use the smaller clear logo treatment and omit the removed supporting text");
assert(!team.includes("Name to be provided") && !team.includes("executive-placeholder") && !board.includes("Name to be provided") && !board.includes("executive-placeholder"), "Board/Leadership sections must not create or retain placeholder people");
assert(board.includes("Board of Directors") && board.includes("Toluwani Adeseri") && board.includes("Co founder") && board.includes("biography"), "The separate Board section and its approved record must remain");
assert(about.includes("<StarfetchBoard />") && about.includes("<Team />"), "About Us must preserve both Board and Leadership sections");

for (const asset of [
  "sylvia-igwe-okparaeke.png", "toluwani-adeseri.png", "institution-page.png", "institution-united-capital.png", "institution-arm.png", "institution-ngx.png", "institution-kpmg.png", "institution-renaissance-capital.png", "institution-renmoney.png", "institution-accelerex.png", "institution-aipec.png", "institution-aca.png",
]) assert(existsSync(resolve(root, "public/images", asset)), `Approved supplied visual asset is missing: ${asset}`);

console.log("PASS — About Us Board and Leadership cards use clean vertical two-column desktop structure, preserve supplied people/bios/credentials, retain distinct sections and institution marks, and remove placeholder personnel");
