import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getGreetingEmoji, getGreetingForHour, getTimeGreeting } from "../lib/greeting";

const root = process.cwd();
const welcomeBanner = readFileSync(join(root, "components/portal/WelcomeBanner.tsx"), "utf8");
const dashboardGreeting = readFileSync(join(root, "components/portal/DashboardGreeting.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

// Morning: 00:00-11:59
for (const hour of [0, 5, 9, 11]) {
  expectEqual(getGreetingForHour(hour), "Good morning", `greeting for hour ${hour}`);
}
// Afternoon: 12:00-16:59
for (const hour of [12, 13, 16]) {
  expectEqual(getGreetingForHour(hour), "Good afternoon", `greeting for hour ${hour}`);
}
// Evening: 17:00-23:59
for (const hour of [17, 19, 23]) {
  expectEqual(getGreetingForHour(hour), "Good evening", `greeting for hour ${hour}`);
}
// Invalid hours fall back safely to morning.
for (const hour of [-1, 24, Number.NaN, 9.5]) {
  expectEqual(getGreetingForHour(hour), "Good morning", `fallback for invalid hour ${String(hour)}`);
}

// Date-based helper uses the local hour.
expectEqual(getTimeGreeting(new Date(2026, 0, 1, 8, 30)), "Good morning", "date helper morning");
expectEqual(getTimeGreeting(new Date(2026, 0, 1, 14, 0)), "Good afternoon", "date helper afternoon");
expectEqual(getTimeGreeting(new Date(2026, 0, 1, 20, 15)), "Good evening", "date helper evening");

// Emoji pairing.
expectEqual(getGreetingEmoji("Good morning"), "👋", "morning emoji");
expectEqual(getGreetingEmoji("Good afternoon"), "☀️", "afternoon emoji");
expectEqual(getGreetingEmoji("Good evening"), "🌙", "evening emoji");

// Component source checks: both placards must use the shared helper.
for (const [label, source] of [["WelcomeBanner", welcomeBanner], ["DashboardGreeting", dashboardGreeting]] as const) {
  assert(source.includes("getTimeGreeting"), `${label} must use getTimeGreeting`);
  assert(source.includes("getGreetingEmoji"), `${label} must use getGreetingEmoji`);
  assert(source.includes("useEffect"), `${label} must sync the greeting after mount`);
  assert(!source.includes("Good morning, {firstName}"), `${label} must not hardcode the greeting`);
}

console.log("PASS — dashboard greeting changes with local time of day (morning/afternoon/evening) via the shared helper");
