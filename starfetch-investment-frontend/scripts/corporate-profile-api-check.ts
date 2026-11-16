/**
 * Compatibility wrapper for branches where this older test filename remains.
 * The former backend API contract was retired when Corporate Profile became
 * a current-session-only form. Reuse the replacement no-API/local-only check
 * instead of importing removed backend client functions.
 */
import "./corporate-profile-local-only-check";
