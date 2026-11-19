/** Synthetic status values; these never authorize or process a transaction. */
export const transactionStatuses = [
  "Pending Approval", "Under Review", "Processing", "Completed", "Failed", "Flagged", "Approved", "Rejected",
] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];
export function isTransactionStatus(value: string): value is TransactionStatus {
  return transactionStatuses.some(status => status === value);
}
