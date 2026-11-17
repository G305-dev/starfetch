import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TimeGreeting } from "../lib/greeting";

// Keep the source check on the same project-root compilation path as its peers.
type _TimeGreetingContract = TimeGreeting;

const root = process.cwd();
const styles = readFileSync(join(root, "app/globals.css"), "utf8");
const navbar = readFileSync(join(root, "components/Navbar.tsx"), "utf8");
const portalSidebar = readFileSync(join(root, "components/portal/PortalSidebar.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Public navbar stays pinned on mobile: sticky header + clip (not hidden)
// so the sticky positioning keeps working while horizontal overflow is hidden.
assert(navbar.includes("sticky top-0"), "Public navbar header must stay sticky");
assert(styles.includes("overflow-x: clip"), "Body must use overflow-x: clip so sticky headers keep working on mobile");

// Portal mobile toggle stays pinned while scrolling: fixed, not absolute.
assert(portalSidebar.includes('<summary className="fixed left-5 top-4'), "Portal mobile menu toggle must be fixed so it stays visible while scrolling");
assert(!portalSidebar.includes('<summary className="absolute left-5 top-4'), "Portal mobile menu toggle must not scroll away with the page");

console.log("PASS — mobile menu icons stay visible while scrolling (sticky public navbar + fixed portal toggle)");
