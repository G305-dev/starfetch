/**
 * Shared runtime harness plumbing — REAL components, mocked network only.
 *
 * Unlike the V3 harness, this module mounts the actual `AuthProvider` and the
 * actual guard/forms through `react-test-renderer`. Only the two things a
 * headless run cannot provide are substituted:
 *
 *   1. Next.js router hooks (`next/navigation`, `next/link`).
 *   2. The HTTP boundary (`globalThis.fetch` -> an in-process backend model).
 *
 * Everything else — AuthProvider's own state machine, the context guards, the
 * login resolver, the membership-refresh module, the Joint components — is the
 * shipped code, executed as-is. The in-memory access token, refresh rotation,
 * 401 handling and logout rules all come from lib/api/client, unmodified.
 */
import { createElement, type ComponentType, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

export type Context = "INDIVIDUAL" | "JOINT" | "CORPORATE";

export type Projection = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "INVESTOR" | "STAFF" | "ADMIN";
  emailVerified?: boolean;
  authorizedContexts?: Context[];
  jointMembershipCount?: number;
  primaryAccountType?: "INDIVIDUAL" | "CORPORATE" | null;
  companyName?: string;
  companyPhoneNumber?: string;
};

export type RouterState = { pathname: string; pushes: string[]; replaces: string[] };

export type Harness = {
  router: RouterState;
  /** How many times each backend endpoint was actually hit. */
  calls: Record<string, number>;
  /** Force the next /me reads to fail in a specific way. */
  me: MeBehaviour;
  /** Forced behaviour for the token-rotation endpoint. */
  refresh: RefreshBehaviour;
  /** Current backend truth: what a fresh, authorised /me would return. */
  projection: Projection;
  /** Joint invitation inbox as the backend would return it. */
  invitations: Array<Record<string, string>>;
  /** Joint account summaries returned to the caller. */
  accounts: Array<Record<string, unknown>>;
  /** Ids recorded when a mutation succeeds (to prove it is never repeated). */
  acceptedInvitations: string[];
  createdAccounts: number;
};

export type MeBehaviour = { kind: "ok" } | { kind: "network" } | { kind: "server" } | { kind: "unauthenticated" };
export type RefreshBehaviour = { kind: "ok" } | { kind: "unauthenticated" } | { kind: "network" };

function createHarness(): Harness {
  return {
    router: { pathname: "/", pushes: [], replaces: [] },
    calls: {},
    me: { kind: "ok" },
    refresh: { kind: "ok" },
    projection: {},
    invitations: [],
    accounts: [],
    acceptedInvitations: [],
    createdAccounts: 0,
  };
}

/**
 * The preload script installs the harness BEFORE any app code loads, and the
 * stubbed router closes over it. Reuse it if present: creating a second object
 * here would silently detach navigation from the assertions.
 */
const state: Harness = ((globalThis as any).__sfHarness as Harness) ?? createHarness();
(globalThis as any).__sfHarness = state;

/** The harness object the stdio driver can inspect after the run. */
export function harness(): Harness {
  return (globalThis as any).__sfHarness as Harness;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function apiError(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status);
}

/** The backend SafeUser projection, built from the current harness truth. */
function safeUser(projection: Projection) {
  return {
    id: projection.id ?? "user-1",
    firstName: projection.firstName ?? "Ada",
    lastName: projection.lastName ?? "Okeke",
    email: projection.email ?? "ada@example.test",
    role: projection.role ?? "INVESTOR",
    emailVerified: projection.emailVerified ?? true,
    ...(projection.authorizedContexts ? { authorizedContexts: projection.authorizedContexts } : {}),
    ...(projection.jointMembershipCount !== undefined ? { jointMembershipCount: projection.jointMembershipCount } : {}),
    ...(projection.primaryAccountType !== undefined ? { primaryAccountType: projection.primaryAccountType } : {}),
    ...(projection.companyName ? { companyName: projection.companyName } : {}),
    ...(projection.companyPhoneNumber ? { companyPhoneNumber: projection.companyPhoneNumber } : {}),
  };
}

/**
 * In-process backend model. Mirrors the real contract closely enough that the
 * unmodified client parses every response through its own normalisers — a
 * shape mistake surfaces as UNEXPECTED_RESPONSE rather than passing silently.
 */
export function installBackendMock() {
  const base = harness();
  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^\/api\/v1/, "").split("?")[0];
    const key = `${method} ${path}`;
    base.calls[key] = (base.calls[key] ?? 0) + 1;

    if (path === "/auth/refresh") {
      if (base.refresh.kind === "unauthenticated") return apiError("UNAUTHENTICATED", "session ended", 401);
      if (base.refresh.kind === "network") throw new TypeError("network down");
      return json({ data: { accessToken: "rotated-access-token" } });
    }

    if (path === "/auth/logout") return json({ data: { loggedOut: true } });

    if (path === "/auth/login" && method === "POST") {
      return json({ data: { accessToken: "login-access-token", user: safeUser(base.projection) } });
    }

    if (path === "/me") {
      if (base.me.kind === "network") throw new TypeError("network down");
      if (base.me.kind === "server") return apiError("SERVICE_UNAVAILABLE", "try later", 503);
      if (base.me.kind === "unauthenticated") return apiError("UNAUTHENTICATED", "session ended", 401);
      return json({ data: safeUser(base.projection) });
    }

    if (path === "/me/joint-invitations") return json({ data: base.invitations });
    if (path === "/me/joint-accounts") return json({ data: base.accounts });

    const accept = path.match(/^\/me\/joint-invitations\/([^/]+)\/accept$/);
    if (accept && method === "POST") {
      base.acceptedInvitations.push(decodeURIComponent(accept[1]));
      return json({ data: { jointAccountId: "joint-1", joinedAt: "2026-11-17T10:00:00.000Z" } });
    }
    const decline = path.match(/^\/me\/joint-invitations\/([^/]+)\/decline$/);
    if (decline && method === "POST") {
      return json({ data: { invitationId: decodeURIComponent(decline[1]), status: "DECLINED" } });
    }

    if (path === "/joint-accounts" && method === "POST") {
      base.createdAccounts += 1;
      return json({
        data: {
          jointAccountId: "joint-1",
          displayName: "The Okeke Family",
          invitation: {
            invitationId: "inv-1",
            status: "PENDING",
            invitedEmailMasked: "s***@example.test",
            expiresAt: "2026-11-24T10:00:00.000Z",
          },
        },
      });
    }

    return apiError("UNEXPECTED_RESPONSE", `no mock for ${key}`, 404);
  };
}

/** A component that reports the provider's live auth state on every render. */
export function makeProbe() {
  const snapshots: Array<{ status: string; contexts: Context[] | null; userId: string | null }> = [];
  function Probe() {
    const { useAuth } = require("../../components/auth/AuthProvider");
    const { status, user } = useAuth();
    snapshots.push({
      status,
      contexts: Array.isArray(user?.authorizedContexts) ? [...user.authorizedContexts] : null,
      userId: user?.id ?? null,
    });
    return null;
  }
  return { Probe, snapshots, latest: () => snapshots[snapshots.length - 1] };
}

/** Mounts `children` inside the REAL AuthProvider and settles initial restore. */
export async function mountWithProvider(children: ReactNode) {
  const { AuthProvider } = require("../../components/auth/AuthProvider");
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(AuthProvider as ComponentType<{ children: ReactNode }>, null, children), {
      // Host components have no DOM here; give them a stand-in instance so
      // uncontrolled inputs can hold a value (what the user would type).
      createNodeMock: () => ({ value: "" }),
    });
  });
  await settle();
  return renderer!;
}

/** Flushes pending promises/microtasks so the provider can commit. */
export async function settle(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Finds the single rendered element matching a predicate. */
export function find(renderer: ReactTestRenderer, predicate: (node: any) => boolean): any {
  const matches = renderer.root.findAll(predicate, { deep: true });
  return matches;
}

export function textOf(renderer: ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number") { parts.push(String(node)); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.children) walk(node.children);
  };
  walk(renderer.toJSON());
  return parts.join(" ");
}

export { createElement };

// ---------------------------------------------------------------------------
// Interaction helpers (real DOM-less user actions on real components)
// ---------------------------------------------------------------------------

function nodeText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (node.children) return node.children.map(nodeText).join(" ");
  return "";
}

export function buttonLabels(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType("button" as never).map((node: any) => nodeText(node).replace(/\s+/g, " ").trim());
}

/** Clicks the first enabled button whose visible text contains `label`. */
export async function clickButton(renderer: ReactTestRenderer, label: string) {
  const buttons = renderer.root.findAllByType("button" as never);
  const target = buttons.find((node: any) => nodeText(node).toLowerCase().includes(label.toLowerCase()));
  if (!target) throw new Error(`No button matching "${label}". Buttons: ${JSON.stringify(buttonLabels(renderer))}`);
  await act(async () => { await target.props.onClick({ preventDefault() {}, stopPropagation() {} }); });
  await settle();
}

export function hasButton(renderer: ReactTestRenderer, label: string): boolean {
  return buttonLabels(renderer).some((text) => text.toLowerCase().includes(label.toLowerCase()));
}

export async function typeInto(renderer: ReactTestRenderer, inputProps: Record<string, unknown>, value: string) {
  const inputs = renderer.root.findAllByType("input" as never);
  const target = inputs.find((node: any) => Object.entries(inputProps).every(([key, expected]) => node.props[key] === expected));
  if (!target) throw new Error(`No input matching ${JSON.stringify(inputProps)}`);
  await act(async () => {
    target.props.onChange({ target: { value }, currentTarget: { value } });
  });
}

export async function submitForm(renderer: ReactTestRenderer) {
  const form = renderer.root.findByType("form" as never);
  await act(async () => {
    await form.props.onSubmit({ preventDefault() {}, currentTarget: form.props });
  });
  await settle();
}
