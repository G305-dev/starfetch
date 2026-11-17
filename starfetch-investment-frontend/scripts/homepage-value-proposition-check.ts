import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CorporateApplicationState } from "../lib/corporate/application";

// Keep the source check on the same project-root compilation path as its peers.
type _CorporateApplicationStateContract = CorporateApplicationState;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const valueProposition = read("components/ValueProposition.tsx");
const credentials = read("components/CompanyCredentials.tsx");
const styles = read("app/globals.css");
const home = read("app/page.tsx");

for (const subtext of [
  "Straightforward explanations without jargon.",
  "Know what you’re paying before you invest.",
  "Regular, easy-to-understand portfolio updates.",
]) {
  assert(!valueProposition.includes(subtext), `The homepage value proposition must omit the subtext: ${subtext}`);
}

assert(
  valueProposition.includes("Plain-language products")
    && valueProposition.includes("Fees disclosed upfront")
    && valueProposition.includes("Clear client reporting"),
  "The value-proposition headings should remain after removing their subtext",
);
assert(!valueProposition.includes("feature-orbit"), "The animated orbit ornaments should no longer appear in the value-proposition section");
assert(
  credentials.includes("credential-orbit-badge")
    && credentials.includes("credential-orbit-decoration")
    && credentials.includes("credential-orbit-center"),
  "The circular motion ornaments should decorate the Company Credentials section below the value proposition",
);
assert(
  styles.includes("animation: credential-orbit-rotate 10s linear infinite")
    && styles.includes("@keyframes credential-orbit-rotate")
    && styles.includes(".credential-orbit-decoration { animation: none; }"),
  "Credential orbit motion should remain slow and respect reduced-motion preferences",
);
assert(!styles.includes("feature-orbit"), "Obsolete value-proposition orbit styles should be removed");
assert(
  home.indexOf("<ValueProposition />") < home.indexOf("<Reveal><CompanyCredentials /></Reveal>"),
  "Company Credentials must remain the section immediately following the homepage value proposition",
);
assert(
  valueProposition.includes("max-w-[1100px]") && credentials.includes("max-w-[1100px]"),
  "Value proposition and credentials must share the same container width so their dividers align",
);
assert(
  valueProposition.includes("px-5") && valueProposition.includes("lg:px-7")
    && credentials.includes("px-5") && credentials.includes("lg:px-7"),
  "Value proposition and credentials must share the same horizontal padding so their dividers align",
);
assert(
  valueProposition.includes("sm:px-7") && valueProposition.includes("first:sm:pl-0")
    && credentials.includes("sm:px-7") && credentials.includes("first:sm:pl-0"),
  "Value proposition and credentials cells must share the same padding so their dividers align",
);

console.log("PASS — value-proposition subtext is removed and circular motion is assigned to the credentials section below");
