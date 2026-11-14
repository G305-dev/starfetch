export interface AdminLoginErrors { email?: string; password?: string }

/** Client-only input validation. No credentials are verified or sent. */
export function validateAdminLogin(email: string, password: string): AdminLoginErrors {
  const errors: AdminLoginErrors = {};
  const trimmedEmail = email.trim();
  if (!trimmedEmail) errors.email = "Enter your work email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}
