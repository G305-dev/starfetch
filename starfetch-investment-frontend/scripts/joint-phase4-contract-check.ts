import {
  ApiError,
  acceptJointInvitation,
  clearAccessToken,
  createJointAccount,
  createJointInvitation,
  declineJointInvitation,
  getJointAccount,
  getJointPortfolio,
  getJointTransactions,
  getMyJointAccounts,
  getMyJointInvitations,
  hasAccessToken,
  setAccessToken,
  setSessionExpiredListener,
} from "../lib/api/client";
import { formatCurrencyMinor } from "../components/portal/dashboard-formatters";

type RequestLog = { url: string; init?: RequestInit };
type MutationScenario = {
  name: "M1" | "M2" | "M4" | "M5";
  path: string;
  invoke: () => Promise<unknown>;
  success: () => Response;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const unauthenticated = () => json({ error: { code: "UNAUTHENTICATED" } }, 401);

function installDocumentCookie(cookie = "sf_csrf=joint-csrf") {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie },
  });
}

function setDocumentCookie(cookie: string) {
  (globalThis.document as { cookie: string }).cookie = cookie;
}

function requestHeaders(init?: RequestInit) {
  const headers = init?.headers;
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return (headers ?? {}) as Record<string, string>;
}

function expectApiError(error: unknown, code: ApiError["code"], message: string) {
  if (!(error instanceof ApiError) || error.code !== code) throw new Error(message);
}

async function checkContractAndFinancialRendering() {
  const requests: RequestLog[] = [];
  installDocumentCookie();
  setAccessToken("joint-access");

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "/api/v1/me/joint-accounts") return json({ data: [{ jointAccountId: "account-a", displayName: "Ada & Ben", memberCount: 2, holderNames: ["Ada", "Ben"], myJoinedAt: "2026-11-04T10:00:00.000Z", isFull: true, awaitingSecondHolder: false }], meta: { requestId: "r1" } });
    if (url === "/api/v1/joint-accounts/account-a") return json({ data: { jointAccountId: "account-a", displayName: "Ada & Ben", createdAt: "2026-11-01T10:00:00.000Z", members: [{ userId: "user-a", firstName: "Ada", lastName: "Okafor", email: "ada@example.test", joinedAt: "2026-11-01T10:00:00.000Z" }, { userId: "user-b", firstName: "Ben", lastName: "Ike", email: "ben@example.test", joinedAt: "2026-11-04T10:00:00.000Z" }], membership: { capacity: 2, activeCount: 2, awaitingSecondHolder: false } }, meta: { requestId: "r2" } });
    if (url === "/api/v1/joint-accounts/account-a/portfolio") return json({ data: { currency: "NGN", totalValueMinor: 250050, holdingCount: 1, totalReturnMinor: null, holdings: [{ id: "holding-a", instrumentLabel: "Fixed Note", quantity: "10.5", valueMinor: 250050, currency: "NGN", asOf: "2026-11-04T10:00:00.000Z", isDemo: false }] }, meta: { requestId: "r3", asOf: "2026-11-04T10:00:00.000Z" } });
    if (url === "/api/v1/joint-accounts/account-a/transactions?page=2&pageSize=10") return json({ data: [{ id: "transaction-a", type: "CREDIT", status: "POSTED", amountMinor: 250050, currency: "NGN", description: "Recorded funding", occurredAt: "2026-11-04T10:00:00.000Z" }], meta: { requestId: "r4", page: 2, pageSize: 10, total: 11 } });
    if (url === "/api/v1/me/joint-invitations") return json({ data: [{ invitationId: "invite-a", jointAccountId: "account-a", accountDisplayName: "Ada & Ben", inviterFirstName: "Ada", expiresAt: "2026-11-11T10:00:00.000Z", sentAt: "2026-11-04T10:00:00.000Z" }], meta: { requestId: "m3" } });
    if (url === "/api/v1/joint-accounts" && init?.method === "POST") return json({ data: { jointAccountId: "account-created", displayName: "Ada & Ben", invitation: { invitationId: "invite-created", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" } }, meta: { requestId: "m1" } }, 201);
    if (url === "/api/v1/joint-accounts/account-a/invitations") return json({ data: { invitationId: "invite-reinvite", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" }, meta: { requestId: "m2" } }, 201);
    if (url === "/api/v1/me/joint-invitations/invite-a/accept") return json({ data: { jointAccountId: "account-a", joinedAt: "2026-11-04T11:00:00.000Z" }, meta: { requestId: "m4" } });
    if (url === "/api/v1/me/joint-invitations/invite-a/decline") return json({ data: { invitationId: "invite-a", status: "DECLINED" }, meta: { requestId: "m5" } });
    if (url === "/api/v1/joint-accounts/not-accessible/portfolio") return json({ error: { code: "NOT_FOUND" } }, 404);
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const [accounts, detail, portfolio, page, invitations, created, reinvited, accepted, declined] = await Promise.all([
    getMyJointAccounts(), getJointAccount("account-a"), getJointPortfolio("account-a"), getJointTransactions("account-a", 2, 10), getMyJointInvitations(), createJointAccount({ inviteeEmail: "ben@example.test" }), createJointInvitation("account-a", "ben@example.test"), acceptJointInvitation("invite-a"), declineJointInvitation("invite-a"),
  ]);

  if (accounts[0]?.memberCount !== 2 || detail.members.length !== 2 || portfolio.totalValueMinor !== 250050 || portfolio.totalReturnMinor !== null || portfolio.holdings[0]?.quantity !== "10.5" || page.page !== 2 || page.pageSize !== 10 || page.total !== 11 || page.transactions[0]?.description !== "Recorded funding" || invitations[0]?.inviterFirstName !== "Ada" || created.invitation.status !== "PENDING" || reinvited.status !== "PENDING" || accepted.jointAccountId !== "account-a" || declined.status !== "DECLINED") {
    throw new Error("Joint R1–R4/M1–M5 response parsing failed");
  }

  const mutationRequests = requests.filter((request) => request.init?.method === "POST");
  if (mutationRequests.length !== 4) throw new Error("Expected M1, M2, M4, and M5 mutation requests");
  for (const request of mutationRequests) {
    const headers = requestHeaders(request.init);
    if (headers.Authorization !== "Bearer joint-access" || headers["X-CSRF-Token"] !== "joint-csrf") throw new Error("A Joint mutation bypassed shared auth/CSRF safeguards");
  }
  const createRequest = mutationRequests.find((request) => request.url === "/api/v1/joint-accounts");
  if (createRequest?.init?.body !== JSON.stringify({ inviteeEmail: "ben@example.test" })) throw new Error("M1 sent unsupported fields");

  try {
    await getJointPortfolio("not-accessible");
    throw new Error("Expected NOT_FOUND");
  } catch (error) {
    expectApiError(error, "NOT_FOUND", "Joint NOT_FOUND privacy mapping failed");
  }

  const largestSafe = formatCurrencyMinor(Number.MAX_SAFE_INTEGER, "NGN");
  if (formatCurrencyMinor(null, "NGN") !== "Not available" || formatCurrencyMinor(Number.MAX_SAFE_INTEGER + 1, "NGN") !== "Not available" || largestSafe.includes("e+") || !largestSafe.includes(".91")) {
    throw new Error("Minor-unit formatting safety failed");
  }
}

async function checkMutationCsrfRotationAndRetryBoundary() {
  const scenarios: MutationScenario[] = [
    { name: "M1", path: "/api/v1/joint-accounts", invoke: () => createJointAccount({ inviteeEmail: "ben@example.test" }), success: () => json({ data: { jointAccountId: "account-created", displayName: "Ada & Ben", invitation: { invitationId: "invite-created", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" } } }, 201) },
    { name: "M2", path: "/api/v1/joint-accounts/account-a/invitations", invoke: () => createJointInvitation("account-a", "ben@example.test"), success: () => json({ data: { invitationId: "invite-reinvite", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" } }, 201) },
    { name: "M4", path: "/api/v1/me/joint-invitations/invite-a/accept", invoke: () => acceptJointInvitation("invite-a"), success: () => json({ data: { jointAccountId: "account-a", joinedAt: "2026-11-04T11:00:00.000Z" } }) },
    { name: "M5", path: "/api/v1/me/joint-invitations/invite-a/decline", invoke: () => declineJointInvitation("invite-a"), success: () => json({ data: { invitationId: "invite-a", status: "DECLINED" } }) },
  ];

  for (const scenario of scenarios) {
    const oldToken = `expired-${scenario.name}`;
    const newToken = `refreshed-${scenario.name}`;
    const oldCsrf = `old-csrf-${scenario.name}`;
    const newCsrf = `rotated-csrf-${scenario.name}`;
    let mutationAttempts = 0;
    let refreshes = 0;
    installDocumentCookie(`sf_csrf=${oldCsrf}`);
    setAccessToken(oldToken);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = requestHeaders(init);
      if (url === "/api/v1/auth/refresh") {
        refreshes += 1;
        if (headers["X-CSRF-Token"] !== oldCsrf) throw new Error(`${scenario.name} refresh did not use the current pre-rotation CSRF token`);
        setDocumentCookie(`sf_csrf=${newCsrf}`);
        return json({ data: { accessToken: newToken } });
      }
      if (url === scenario.path) {
        mutationAttempts += 1;
        if (mutationAttempts === 1) {
          if (headers.Authorization !== `Bearer ${oldToken}` || headers["X-CSRF-Token"] !== oldCsrf) throw new Error(`${scenario.name} initial mutation headers were incorrect`);
          return unauthenticated();
        }
        if (mutationAttempts === 2) {
          if (headers.Authorization !== `Bearer ${newToken}` || headers["X-CSRF-Token"] !== newCsrf || headers["X-CSRF-Token"] === oldCsrf) throw new Error(`${scenario.name} retry reused stale authorization or CSRF state`);
          return scenario.success();
        }
        throw new Error(`${scenario.name} mutation retried more than once`);
      }
      throw new Error(`Unexpected ${scenario.name} URL: ${url}`);
    }) as typeof fetch;

    await scenario.invoke();
    if (mutationAttempts !== 2 || refreshes !== 1) throw new Error(`${scenario.name} did not perform one refresh and one bounded retry`);
  }

  let serverErrorPosts = 0;
  let serverErrorRefreshes = 0;
  installDocumentCookie("sf_csrf=server-error-csrf");
  setAccessToken("valid-server-error-token");
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/joint-accounts") { serverErrorPosts += 1; return json({ error: { code: "UNEXPECTED_RESPONSE" } }, 500); }
    if (url === "/api/v1/auth/refresh") { serverErrorRefreshes += 1; return json({ data: { accessToken: "should-not-be-used" } }); }
    throw new Error(`Unexpected retry-boundary URL: ${url}`);
  }) as typeof fetch;
  try {
    await createJointAccount({ inviteeEmail: "ben@example.test" });
    throw new Error("Expected server error");
  } catch (error) {
    expectApiError(error, "UNEXPECTED_RESPONSE", "Server errors must not replay a mutation");
  }
  if (serverErrorPosts !== 1 || serverErrorRefreshes !== 0) throw new Error("A mutation was replayed after a non-401 server failure");
}

async function checkRefreshFailureAndConcurrentMutationSafety() {
  let expiredEvents = 0;
  let failedPosts = 0;
  let failedRefreshes = 0;
  const unsubscribe = setSessionExpiredListener(() => { expiredEvents += 1; });
  installDocumentCookie("sf_csrf=refresh-failure-csrf");
  setAccessToken("expired-refresh-failure");
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/joint-accounts") { failedPosts += 1; return unauthenticated(); }
    if (url === "/api/v1/auth/refresh") { failedRefreshes += 1; return unauthenticated(); }
    throw new Error(`Unexpected refresh-failure URL: ${url}`);
  }) as typeof fetch;
  try {
    await createJointAccount({ inviteeEmail: "ben@example.test" });
    throw new Error("Expected refresh failure");
  } catch (error) {
    expectApiError(error, "UNAUTHENTICATED", "Refresh failure did not end the expired session");
  }
  if (failedPosts !== 1 || failedRefreshes !== 1 || hasAccessToken() || expiredEvents !== 1) throw new Error("Refresh failure did not clear only the expired session exactly once");
  unsubscribe();

  let refreshes = 0;
  const attempts = new Map<string, number>();
  installDocumentCookie("sf_csrf=concurrent-old-csrf");
  setAccessToken("concurrent-expired-token");
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = requestHeaders(init);
    if (url === "/api/v1/auth/refresh") {
      refreshes += 1;
      if (headers["X-CSRF-Token"] !== "concurrent-old-csrf") throw new Error("Concurrent refresh did not use current CSRF token");
      setDocumentCookie("sf_csrf=concurrent-new-csrf");
      return json({ data: { accessToken: "concurrent-new-token" } });
    }
    if (url === "/api/v1/joint-accounts" || url === "/api/v1/joint-accounts/account-a/invitations") {
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (count === 1) return unauthenticated();
      if (headers.Authorization !== "Bearer concurrent-new-token" || headers["X-CSRF-Token"] !== "concurrent-new-csrf") throw new Error("Concurrent mutation retry used stale credentials");
      return url.endsWith("/invitations")
        ? json({ data: { invitationId: "invite-reinvite", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" } }, 201)
        : json({ data: { jointAccountId: "account-created", displayName: "Ada & Ben", invitation: { invitationId: "invite-created", invitedEmailMasked: "b***@example.test", expiresAt: "2026-11-11T10:00:00.000Z", status: "PENDING" } } }, 201);
    }
    throw new Error(`Unexpected concurrent URL: ${url}`);
  }) as typeof fetch;
  await Promise.all([createJointAccount({ inviteeEmail: "ben@example.test" }), createJointInvitation("account-a", "ben@example.test")]);
  if (refreshes !== 1 || attempts.get("/api/v1/joint-accounts") !== 2 || attempts.get("/api/v1/joint-accounts/account-a/invitations") !== 2) throw new Error("Concurrent Joint mutations did not share a single bounded refresh");
}

async function checkJointRefreshAndLogoutIsolation() {
  setAccessToken("old");
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let expiryEvents = 0;
  const unsubscribe = setSessionExpiredListener(() => { expiryEvents += 1; });
  installDocumentCookie("sf_csrf=logout-isolation-csrf");
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/joint-accounts") return unauthenticated();
    if (url === "/api/v1/auth/refresh") { await gate; return json({ data: { accessToken: "stale" } }); }
    throw new Error(`Unexpected logout-isolation URL: ${url}`);
  }) as typeof fetch;
  const pending = createJointAccount({ inviteeEmail: "ben@example.test" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  setAccessToken("newer-login");
  release?.();
  try {
    await pending;
    throw new Error("Expected stale operation failure");
  } catch (error) {
    expectApiError(error, "UNAUTHENTICATED", "Stale mutation returned a session token after logout/user switch");
  }
  if (!hasAccessToken() || expiryEvents !== 0) throw new Error("A stale Joint mutation cleared a newer session");

  setAccessToken("logout-in-progress");
  let releaseLogout: (() => void) | undefined;
  const logoutGate = new Promise<void>((resolve) => { releaseLogout = resolve; });
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/joint-accounts") return unauthenticated();
    if (url === "/api/v1/auth/refresh") { await logoutGate; return json({ data: { accessToken: "must-not-restore" } }); }
    throw new Error(`Unexpected explicit-logout URL: ${url}`);
  }) as typeof fetch;
  const pendingLogout = createJointAccount({ inviteeEmail: "ben@example.test" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearAccessToken();
  releaseLogout?.();
  try {
    await pendingLogout;
    throw new Error("Expected explicit logout to invalidate the in-flight mutation");
  } catch (error) {
    expectApiError(error, "UNAUTHENTICATED", "An in-flight mutation restored authority after logout");
  }
  if (hasAccessToken() || expiryEvents !== 0) throw new Error("Explicit logout was overwritten or emitted a stale expiry event");
  unsubscribe();
}

async function run() {
  await checkContractAndFinancialRendering();
  await checkMutationCsrfRotationAndRetryBoundary();
  await checkRefreshFailureAndConcurrentMutationSafety();
  await checkJointRefreshAndLogoutIsolation();
  console.log("PASS — Joint Phase 4 contract, rotated-CSRF mutation retry, refresh/session isolation, financial-data safety, pagination, and privacy checks");
}

void run();
