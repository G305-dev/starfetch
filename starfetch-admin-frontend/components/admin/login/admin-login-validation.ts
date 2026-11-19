export interface AdminLoginErrors { email?: string; password?: string }

/** Client-only input validation. No credentials are verified or sent. */
export function validateAdminLogin(email: string, password: string): AdminLoginErrors {
  const errors: AdminLoginErrors = {};
  const trimmedEmail = email.trim();
  if (trimmedEmail !== "demo@example.com") errors.email = "Use the placeholder email demo@example.com.";
  if (password !== "demo-only") errors.password = "Use the placeholder password demo-only.";
  return errors;
}
