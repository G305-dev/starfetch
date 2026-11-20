/**
 * In-memory handoff of the server-issued Corporate account ID from a confirmed
 * O2 creation receipt to the Corporate Profile page.
 *
 * - Memory only: never written to localStorage, sessionStorage, cookies or the
 *   URL, so a refresh simply falls back to owner-scoped discovery.
 * - Bound to the authenticated user ID that created the application; another
 *   user never receives it.
 * - It is a selection hint only. The Corporate Profile still loads an account
 *   only if the authenticated owner-scoped discovery API returns that ID, so it
 *   can never grant access to an account the backend does not authorise.
 */
type CreatedCorporateAccount = { userId: string; corporateAccountId: string };

let createdCorporateAccount: CreatedCorporateAccount | null = null;

export function rememberCreatedCorporateAccount(userId: string, corporateAccountId: string) {
  createdCorporateAccount = { userId, corporateAccountId };
}

/** Returns the remembered ID for this user, or null. A different user's value is discarded. */
export function getCreatedCorporateAccountId(userId: string): string | null {
  if (!createdCorporateAccount) return null;
  if (createdCorporateAccount.userId !== userId) {
    createdCorporateAccount = null;
    return null;
  }
  return createdCorporateAccount.corporateAccountId;
}

export function clearCreatedCorporateAccount() {
  createdCorporateAccount = null;
}
