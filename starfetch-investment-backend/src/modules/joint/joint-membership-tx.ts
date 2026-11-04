import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Phase 3B Step 2 — reusable transactional utilities implementing the APPROVED
 * membership concurrency protocol (docs/backend/joint/03 §3):
 *
 *   GLOBAL LOCK ORDER: joint_accounts row FIRST, invitation rows SECOND.
 *   Every mutation touching both levels must follow it — this removes the
 *   invitation-first/account-first cycle that could deadlock.
 *
 * These helpers are the ONLY locking entry points; the full invitation
 * business service (create/accept/decline) is a later Phase 3B step and must
 * compose them inside one `prisma.$transaction(async (tx) => …)`.
 */

/** Lock the parent account row (serializes all membership/invitation flows). */
export async function lockJointAccount(
  tx: Tx,
  jointAccountId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "joint_accounts" WHERE "id" = ${jointAccountId}::uuid FOR UPDATE`,
  );
  return rows[0]?.id ?? null;
}

/** Lock + read an invitation row inside the transaction (authoritative read). */
export async function lockJointInvitation(
  tx: Tx,
  invitationId: string,
): Promise<{
  id: string;
  jointAccountId: string;
  invitedEmailNormalized: string;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  expiresAt: Date;
} | null> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      jointAccountId: string;
      invitedEmailNormalized: string;
      invitedByUserId: string;
      acceptedByUserId: string | null;
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
      expiresAt: Date;
    }>
  >(
    Prisma.sql`SELECT "id","jointAccountId","invitedEmailNormalized","invitedByUserId","acceptedByUserId","status","expiresAt"
               FROM "joint_account_invitations" WHERE "id" = ${invitationId}::uuid FOR UPDATE`,
  );
  return rows[0] ?? null;
}

/** Active-member count — capacity check MUST run inside the parent lock. */
export async function countActiveMembers(
  tx: Tx,
  jointAccountId: string,
): Promise<number> {
  return tx.jointAccountMember.count({ where: { jointAccountId } });
}

/** Non-blocking probe used only to discover the parent account id. Its result
 * is NEVER trusted — callers re-read everything under lock. */
export async function probeInvitationAccountId(
  tx: Tx,
  invitationId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ jointAccountId: string }>>(
    Prisma.sql`SELECT "jointAccountId" FROM "joint_account_invitations" WHERE "id" = ${invitationId}::uuid`,
  );
  return rows[0]?.jointAccountId ?? null;
}
