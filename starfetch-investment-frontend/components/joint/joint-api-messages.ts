import { getSafeErrorMessage, isApiError } from "@/lib/api/client";

/** Contextual but non-enumerating messages for Joint API outcomes. */
export function getJointActionErrorMessage(error: unknown) {
  if (!isApiError(error)) return getSafeErrorMessage(error);
  if (error.code === "EMAIL_NOT_VERIFIED") return "Verify your email address before using Joint Account features.";
  if (error.code === "NOT_FOUND") return "This Joint Account item is not available to your account.";
  if (error.code === "GONE") return "This invitation has expired and is no longer available.";
  if (error.code === "CONFLICT") return "This request conflicts with the current Joint Account state. Refresh and try again.";
  if (error.code === "RATE_LIMITED") return error.retryAfterSeconds ? `Please wait ${error.retryAfterSeconds} seconds before trying again.` : "Too many requests were made. Please wait a moment and try again.";
  return getSafeErrorMessage(error);
}

export function formatJointDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
