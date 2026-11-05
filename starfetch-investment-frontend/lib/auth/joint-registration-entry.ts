export type JointRegistrationEntryStatus = "loading" | "authenticated" | "unauthenticated";
export type JointRegistrationEntryAction = "wait" | "continue" | "explain";

/** The sign-in action always returns to the protected Joint creation route. */
export const JOINT_REGISTRATION_SIGN_IN_HREF = "/login?next=%2Fregister%2Fjoint";
export const INDIVIDUAL_REGISTRATION_HREF = "/register/individual";

export function getJointRegistrationEntryAction(status: JointRegistrationEntryStatus): JointRegistrationEntryAction {
  if (status === "authenticated") return "continue";
  if (status === "unauthenticated") return "explain";
  return "wait";
}
