import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serviceDetails } from "../components/services/services-data";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// Strip block comments so boundary comments do not trip endpoint assertions.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// --- Shared catalogue: exactly the three approved products, no invented data ---
assert(serviceDetails.length === 3, "The product catalogue must contain exactly three products");
assert(
  serviceDetails.map((service) => service.id).join(",") === "fixed-note,discretionary-portfolios,execution-mandate",
  "The catalogue must contain Fixed Note, Discretionary Portfolios and Execution Mandate",
);

const corporatePage = read("app/corporate/products/page.tsx");
const corporateFixedNotePage = read("app/corporate/products/fixed-note/page.tsx");
const corporateContentRaw = read("components/corporate/CorporateProductsContent.tsx");
const corporateContent = stripComments(corporateContentRaw);
const corporateFixedNoteInfo = read("components/corporate/CorporateFixedNoteInfo.tsx");
const individualPage = read("app/products/page.tsx");
const jointPage = read("app/joint/products/page.tsx");
const productsContent = read("components/portal/ProductsContent.tsx");

// --- Corporate Products page wiring ---
assert(corporatePage.includes("CorporatePortalLayout"), "Corporate Products must stay inside the Corporate Portal layout");
assert(corporatePage.includes("<CorporateProductsContent />"), "Corporate Products must render CorporateProductsContent");
assert(!corporatePage.includes('from "@/components/portal/ProductsContent"') && !corporatePage.includes("<ProductsContent"), "Corporate Products must not render the Individual/Joint ProductsContent workflow");

// --- Corporate content reuses the approved presentation ---
assert(corporateContent.includes('from "@/components/services/services-data"'), "Corporate Products must reuse the shared serviceDetails catalogue");
assert(corporateContent.includes("serviceDetails.map((service) => ("), "Corporate Products must render every catalogue product as a card");
assert(corporateContent.includes("View Details"), "Corporate product cards must expose View Details");
assert(corporateContent.includes("Invest Now"), "Corporate product cards must expose the Invest Now action");
assert(corporateContent.includes("Typical use") && corporateContent.includes("Risk character") && corporateContent.includes("How it works"), "Corporate View Details modal must show typical use, risk character and how it works");
assert(corporateContent.includes('from "next/link"') && corporateContent.includes("<Link"), "Corporate product navigation must use next/link client-side routing");

// --- Corporate investment actions are unavailable, never transactional ---
assert(corporateContent.includes("Corporate investment actions are unavailable"), "Corporate Invest Now must open a Corporate-specific unavailable notice");
assert(corporateContent.includes("No investment instruction, booking, funding request, enquiry, or company information will be submitted."), "Corporate Invest Now must not submit any instruction, booking, funding request or enquiry");
assert(!corporateContent.includes("Buy Now"), "Corporate Products must not expose the legacy Buy Now action");
assert(!corporateContent.includes("ProductEnquiryForm"), "Corporate Products must not reuse the legacy enquiry form");
assert(!corporateContent.includes("Interest confirmed"), "Corporate Products must never show a false investment success message");

// --- Strict route separation: Corporate never links to Individual routes ---
assert(corporateContent.includes('"/corporate/products/fixed-note"'), "Corporate Fixed Note destination must be /corporate/products/fixed-note");
assert(!corporateContent.includes('href="/products"'), "Corporate Products must never link to /products");
assert(!corporateContent.includes('href="/products/fixed-note"'), "Corporate Products must never link to /products/fixed-note");
assert(!corporateContent.includes('href="/profile"'), "Corporate Products must never link to /profile");
assert(!corporateContent.includes('href="/dashboard"'), "Corporate Products must never link to /dashboard");
assert(!corporateContent.includes('from "@/components/portal/'), "Corporate Products must not import Individual portal workflow components");

// --- No Individual APIs, no token storage ---
assert(!corporateContent.includes("getIndividualKycProfile"), "Corporate Products must never call the Individual KYC endpoint");
assert(!corporateContent.includes("/me/kyc-profile"), "Corporate Products must never call Individual KYC submission endpoints");
assert(!/(localStorage|sessionStorage)\s*\.\s*setItem/.test(corporateContent), "Corporate Products must never store tokens in browser storage");

// --- Corporate Fixed Note page ---
assert(corporateFixedNotePage.includes("CorporatePortalLayout"), "Corporate Fixed Note must stay inside the Corporate Portal layout");
assert(corporateFixedNotePage.includes("<CorporateFixedNoteInfo />"), "Corporate Fixed Note must render CorporateFixedNoteInfo");
assert(!corporateFixedNotePage.includes("IndividualFixedNoteInfo"), "Corporate Fixed Note must not use the Individual Fixed Note page directly");
assert(!corporateFixedNotePage.includes("CorporateProductsContent"), "Corporate Fixed Note must not reuse the unavailable placeholder");
assert(corporateFixedNoteInfo.includes('backHref = "/corporate/products"'), "Corporate Fixed Note back destination must be /corporate/products");
assert(corporateFixedNoteInfo.includes("Starfetch Fixed Note"), "Corporate Fixed Note must display the Fixed Note product information");
assert(corporateFixedNoteInfo.includes("Online booking is unavailable"), "Corporate Fixed Note must keep booking disabled with a clear notice");
assert(corporateFixedNoteInfo.includes("No investment is created from the Corporate Portal."), "Corporate Fixed Note must not create investments");
// Ignore Tailwind arbitrary values (e.g. gradient stops like 0%/100%) when
// checking for published rates: only real copy could carry a rate or amount.
const fixedNoteInfoCopy = corporateFixedNoteInfo.replace(/\[[^\]]*\]/g, "");
assert(!fixedNoteInfoCopy.includes("₦") && !fixedNoteInfoCopy.includes("NGN") && !/\d\s*%/.test(fixedNoteInfoCopy), "Corporate Fixed Note must not publish invented rates, minimums or returns");
assert(!corporateFixedNoteInfo.includes('href="/products"'), "Corporate Fixed Note must never link back to Individual /products");

// --- Individual and Joint workflows untouched ---
assert(individualPage.includes("<ProductsContent />"), "Individual Products must keep rendering ProductsContent with Individual defaults");
assert(productsContent.includes("showIndividualInvestNowActions = true"), "Individual Products must keep Invest Now enabled by default");
assert(jointPage.includes("showIndividualInvestNowActions={false}"), "Joint Products must keep Individual Invest Now actions disabled");

console.log("PASS — Corporate Products matches the Individual design inside the Corporate Portal: /corporate/products and /corporate/products/fixed-note only, unavailable investment actions, no Individual routes, APIs or success messages");
