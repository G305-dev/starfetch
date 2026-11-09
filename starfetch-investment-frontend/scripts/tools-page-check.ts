import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const page = readFileSync(join(root, "app/tools/page.tsx"), "utf8");
const navbar = readFileSync(join(root, "components/Navbar.tsx"), "utf8");
const footer = readFileSync(join(root, "components/Footer.tsx"), "utf8");

for (const text of [
  "Practical tools,",
  "real clarity.",
  "No account needed. Use them, share them, come back to them. If you would like your results emailed to you, we will ask for your consent first — and nothing else.",
  "TOOL 01",
  "Budget Planner",
  "Map your monthly income and spending, see your savings capacity, and compare against the 50/30/20 guideline.",
  "Open the planner →",
  "TOOL 02",
  "Portfolio Allocation Tool",
  "Six questions about your goals and risk comfort produce a suggested split across money-market, fixed-income and growth assets.",
  "Find your mix →",
  "TOOL 03",
  "Returns Calculator",
  "Project lump-sum and monthly contributions with compounding — including the effect of fees on your net outcome.",
  "Run the numbers →",
]) {
  if (!page.includes(text)) throw new Error(`Free Tools page is missing approved copy: ${text}`);
}

if (!page.includes('<Navbar />') || !page.includes('<Footer />')) throw new Error("Free Tools page must use the shared Navbar and Footer");
if (!page.includes('href: "/tools/budget"') || !page.includes('href: "/tools/returns"') || !page.includes('<Link href={tool.href}')) throw new Error("Budget Planner and Returns Calculator cards must use local Next Links");
if ((page.match(/href: "\/tools\/budget"/g) ?? []).length !== 1 || (page.match(/href: "\/tools\/returns"/g) ?? []).length !== 1) throw new Error("Budget Planner and Returns Calculator must each expose exactly one local tool route");
if (!page.includes('aria-disabled="true"') || !page.includes("(Coming soon)")) throw new Error("The unavailable Portfolio Allocation Tool action is not clearly marked as non-functional");
if (/starfetchinvestltd\.com\.ng\/tools/i.test(page)) throw new Error("Free Tools page links to the legacy website");
if (!page.includes('md:grid-cols-2') || !page.includes('lg:grid-cols-3')) throw new Error("Free Tools responsive card grid is missing tablet or desktop layouts");
if (getSafeReturnPath("/tools") !== "/tools") throw new Error("Free Tools route is not a safe internal destination");

if (!navbar.includes('import Link from "next/link";')) throw new Error("Navbar does not import Next Link for Free Tools navigation");
if (!navbar.includes('{ label: "Free Tools", href: "/tools", activePath: "/tools" }')) throw new Error("Navbar Free Tools item does not target /tools with an active route");
if (!navbar.includes('pathname === "/tools" || pathname.startsWith("/tools/")')) throw new Error("Navbar Free Tools state is not active on calculator subroutes");
if ((navbar.match(/href="\/tools"/g) ?? []).length < 2) throw new Error("Navbar does not use local Next Link navigation for both desktop and mobile Free Tools entries");
if (/Free Tools", href: "#tools"/.test(navbar)) throw new Error("Navbar still points Free Tools to the homepage anchor");

if (!footer.includes('{ label: "Free tools", href: "/tools" }')) throw new Error("Footer Free tools does not point to /tools");
if (/starfetchinvestltd\.com\.ng\/tools/i.test(footer)) throw new Error("Footer Free tools uses a legacy website URL");

console.log("PASS — Free Tools page preserves approved hero/card copy, local navigation, responsive grid classes, Budget/Returns Next Links, and the honestly unavailable Portfolio Allocation Tool state");
