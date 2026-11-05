import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getInvitationMutationSuccessMessage, isCurrentNotificationSession } from "../lib/auth/joint-notification-session";

const current = { userId: "investor-a", revision: 7 };
if (!isCurrentNotificationSession(current, "investor-a", 7)) throw new Error("Current invitation mutation session was rejected");
if (isCurrentNotificationSession(current, null, 7)) throw new Error("Logout did not invalidate an invitation mutation session");
if (isCurrentNotificationSession(current, "investor-b", 7)) throw new Error("User switch did not invalidate an invitation mutation session");
if (isCurrentNotificationSession(current, "investor-a", 8)) throw new Error("Session revision change did not invalidate an invitation mutation session");

const acceptAfterRefreshFailure = getInvitationMutationSuccessMessage("accept", "Ada & Ben", false);
const declineAfterRefreshFailure = getInvitationMutationSuccessMessage("decline", "Ada & Ben", false);
if (!acceptAfterRefreshFailure.includes("accepted") || !acceptAfterRefreshFailure.includes("may take a moment") || !declineAfterRefreshFailure.includes("declined") || !declineAfterRefreshFailure.includes("may take a moment")) {
  throw new Error("Completed invitation mutations were not kept successful after an inbox refresh failure");
}

const dashboardSource = readFileSync(join(process.cwd(), "components/joint/JointDashboardContent.tsx"), "utf8");
const profileSource = readFileSync(join(process.cwd(), "components/joint/JointProfileContent.tsx"), "utf8");
const notificationsSource = readFileSync(join(process.cwd(), "components/joint/JointInvitationNotifications.tsx"), "utf8");
if (!dashboardSource.includes("<FinancialSnapshot key={selectedAccountId} jointAccountId={selectedAccountId} />")) throw new Error("Financial snapshot is not keyed to the selected Joint Account");
if (!profileSource.includes("<JointInvitationSender key={detail.jointAccountId} jointAccountId={detail.jointAccountId} />")) throw new Error("Invitation sender is not keyed to the selected Joint Account");
if (!notificationsSource.includes("if (!hasCurrentSession(current.session)) return;") || !notificationsSource.includes("await load({ preserveOnError: true })") || !notificationsSource.includes("setPanelUserId(null)")) {
  throw new Error("Notification mutation session isolation safeguards are incomplete");
}

console.log("PASS — Joint account switch isolation and notification mutation session guards protect stale data, logout/user changes, and successful mutations with failed inbox refreshes");
