import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const page = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const footer = readFileSync(join(root, "components/Footer.tsx"), "utf8");

function plainSource(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const content = plainSource(page);
const requiredPolicyText = [
  'Effective 12 August 2026. This policy explains how Starfetch Investment Limited ("Starfetch", "we") collects and uses personal data, in line with the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection Regulation 2019 (NDPR).',
  "Starfetch Investment Limited · RC 7402697 · Incorporated in Nigeria under CAMA 2020. Our registered office is The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria. For any privacy matter, contact info@starfetchinvestltd.com.ng (marked \"Data Protection\").",
  "Newsletter and free tools: your first name and email address, collected only with your explicit consent, to send you our newsletter and, where you request it, your tool results. We also record the consent text version, date/time and source so we can evidence your consent. Lawful basis: consent.",
  "Enquiries: your name, email and message, used to respond to you. Lawful basis: consent and legitimate interest in responding to your request.",
  "Clients and prospective clients: when onboarding opens, we will collect identity and verification data (including BVN/NIN) as required by law. Lawful basis: legal obligation (KYC/AML) and contract. A supplementary notice will be provided at onboarding.",
  "We do not sell personal data. We do not send marketing without recorded consent. We do not use your tool inputs (income, spending, investment figures) for any purpose other than showing you your results and, if you request it, emailing them to you.",
  "Trusted service providers process data on our instructions under data-processing agreements — website hosting, form handling and email delivery. Where any provider processes data outside Nigeria, we apply the NDPA's cross-border transfer requirements.",
  "Newsletter data is kept until you unsubscribe or ask us to delete it. Enquiry data is kept for up to 24 months after our last exchange. Client records, once onboarding opens, follow statutory retention periods under SEC and AML rules.",
  "Under the NDPA you may access, correct, delete, or receive a copy of your personal data, restrict or object to processing, and withdraw consent at any time (every marketing email includes an unsubscribe link; or email us). You may also complain to the Nigeria Data Protection Commission (NDPC).",
  "Data is transmitted over encrypted connections (HTTPS) and access is restricted to authorised personnel. If a breach is likely to result in risk to you, we will notify the NDPC within 72 hours and affected individuals without undue delay, as the NDPA requires.",
  "Starfetch sets no cookies of its own. We do not run advertising or analytics on this website and we place no tracking cookies. If we introduce analytics we will use a privacy-respecting configuration and update this policy first.",
  "Third-party content on our homepage. Two features on our home page load content from outside our systems, and we would rather tell you plainly than bury it.",
  "The Nigerian equity price ticker at the top of the page is supplied by TradingView, which is licensed to redistribute Nigerian Exchange data. Their widget loads from TradingView's servers, so your browser connects directly to them: your IP address, browser type and the page you are viewing are visible to TradingView, and the widget may set TradingView's own cookies - including analytics and advertising cookies - under TradingView's cookie policy rather than ours. We receive none of that data, and nothing you give us is shared with them. If you block third-party cookies in your browser, the rest of this website works normally.",
  "The market headlines are retrieved through a third-party feed service, which likewise sees your IP address and browser type when the page loads. We are moving that feed onto our own systems.",
  "Everything else on this website - including the policy figures we publish - is served entirely by us. These third-party features appear on the home page only; the rest of the site loads nothing from outside our own systems.",
  "We will post any changes here with a new version number and effective date. Consent records stored by Starfetch reference the version of this policy and of the consent wording that applied when consent was given, so you can always establish what you agreed to and when.",
  "Version 2026-08-12.v5 · Effective 12 August 2026 · Supersedes versions 2026-08-12.v4, 2026-08-12.v3, 2026-08-11.v2 and 2026-07-14.v1 · Owner: Compliance Officer / Data Protection Officer · Next scheduled review: August 2027",
];

for (const text of requiredPolicyText) {
  if (!content.includes(text)) throw new Error(`Privacy policy text is missing or changed: ${text.slice(0, 72)}…`);
}

for (const heading of [
  "1. Who we are",
  "2. What we collect and why",
  "3. What we do not do",
  "4. Who processes your data",
  "5. Retention",
  "6. Your rights",
  "7. Security",
  "8. Cookies, analytics and third-party content",
  "9. Changes",
]) {
  if (!page.includes(`>${heading}</h2>`)) throw new Error(`Privacy policy section heading is missing or not an H2: ${heading}`);
}

if (!page.includes('title: "Privacy Policy | Starfetch Investment Limited"')) throw new Error("Privacy metadata title is missing or changed");
if (!page.includes("description: \"Read Starfetch Investment Limited's Privacy Policy, including how personal data is collected, processed, protected and retained.\"")) throw new Error("Privacy metadata description is missing or changed");
if (!page.includes('href="mailto:info@starfetchinvestltd.com.ng"')) throw new Error("Privacy email link is missing");
if (!page.includes("<Navbar />") || !page.includes("<Footer />")) throw new Error("Privacy page must include the shared Navbar and Footer");
if (!footer.includes('{ label: "Privacy policy", href: "/privacy" }')) throw new Error("Footer Privacy policy must point to /privacy");
if (getSafeReturnPath("/privacy") !== "/privacy") throw new Error("Privacy route is not a safe internal destination");

console.log("PASS — Privacy page preserves the supplied policy paragraphs, nine H2 sections, metadata, email link, shared navigation, and version history");
