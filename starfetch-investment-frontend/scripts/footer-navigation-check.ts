import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const footer = readFileSync(join(root, "components/Footer.tsx"), "utf8");

const expectedInternalLinks = ["/about", "/services", "/tools", "/#contact", "/privacy", "/complaints"];
for (const href of expectedInternalLinks) {
  if (!footer.includes(`href: "${href}"`)) throw new Error(`Footer is missing expected internal destination ${href}`);
  if (getSafeReturnPath(href) !== href) throw new Error(`Footer internal destination is not a safe local path: ${href}`);
}
if (/https?:\/\/(?:www\.)?starfetchinvestltd\.com\.ng/i.test(footer)) throw new Error("Footer still contains a legacy Starfetch website URL");
if (!footer.includes("mailto:info@starfetchinvestltd.com.ng")) throw new Error("Footer email link was unexpectedly removed");
if (!footer.includes('{ label: "Free tools", href: "/tools" }')) {
  throw new Error("Footer Free tools does not point to the local /tools route");
}
if (!footer.includes('{ label: "Privacy policy", href: "/privacy" }')) {
  throw new Error("Footer Privacy policy does not point to the local /privacy route");
}
if (!footer.includes('{ label: "Complaints policy", href: "/complaints" }')) {
  throw new Error("Footer Complaints policy does not point to the local /complaints route");
}
if (!footer.includes('import Link from "next/link";') || !footer.includes('<Link key={link.label} href={link.href}')) throw new Error("Footer internal links do not use Next Link navigation");

for (const page of ["app/about/page.tsx", "app/services/page.tsx", "app/tools/page.tsx", "app/privacy/page.tsx", "app/complaints/page.tsx", "app/page.tsx"]) {
  try { readFileSync(join(root, page), "utf8"); } catch { throw new Error(`Expected route page is missing: ${page}`); }
}

console.log("PASS — Footer internal navigation stays on local routes, including /tools, /privacy, and /complaints; legacy website URLs are absent and email remains external");
