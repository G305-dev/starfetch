export type NotificationSessionSnapshot = {
  userId: string;
  revision: number;
};

/** Prevents an earlier user's async notification result from updating a newer session. */
export function isCurrentNotificationSession(snapshot: NotificationSessionSnapshot, activeUserId: string | null, activeRevision: number) {
  return activeUserId === snapshot.userId && activeRevision === snapshot.revision;
}

export function getInvitationMutationSuccessMessage(action: "accept" | "decline", accountDisplayName: string, inboxRefreshed: boolean) {
  const completed = action === "accept"
    ? `You have accepted the invitation to ${accountDisplayName}.`
    : `You declined the invitation to ${accountDisplayName}.`;
  return inboxRefreshed ? completed : `${completed} Your notifications may take a moment to update.`;
}
