-- CreateEnum
CREATE TYPE "JointInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN     "jointAccountId" UUID,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "joint_accounts" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_account_members" (
    "id" UUID NOT NULL,
    "jointAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_account_invitations" (
    "id" UUID NOT NULL,
    "jointAccountId" UUID NOT NULL,
    "invitedEmailNormalized" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "acceptedByUserId" UUID,
    "status" "JointInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_account_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "joint_account_members_userId_idx" ON "joint_account_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "joint_account_members_jointAccountId_userId_key" ON "joint_account_members"("jointAccountId", "userId");

-- CreateIndex
CREATE INDEX "joint_account_invitations_invitedEmailNormalized_status_idx" ON "joint_account_invitations"("invitedEmailNormalized", "status");

-- CreateIndex
CREATE INDEX "joint_account_invitations_jointAccountId_status_idx" ON "joint_account_invitations"("jointAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_jointAccountId_key" ON "portfolios"("jointAccountId");

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_jointAccountId_fkey" FOREIGN KEY ("jointAccountId") REFERENCES "joint_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_accounts" ADD CONSTRAINT "joint_accounts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_account_members" ADD CONSTRAINT "joint_account_members_jointAccountId_fkey" FOREIGN KEY ("jointAccountId") REFERENCES "joint_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_account_members" ADD CONSTRAINT "joint_account_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_account_invitations" ADD CONSTRAINT "joint_account_invitations_jointAccountId_fkey" FOREIGN KEY ("jointAccountId") REFERENCES "joint_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_account_invitations" ADD CONSTRAINT "joint_account_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_account_invitations" ADD CONSTRAINT "joint_account_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── HAND-AUTHORED (not Prisma-generated) ────────────────────────────────────
-- Phase 3A-reviewed XOR ownership invariant: a portfolio is owned by EXACTLY
-- ONE principal — an individual user (userId) OR a joint account
-- (jointAccountId). Prisma cannot express CHECK constraints, so this block is
-- appended manually and documented in
-- docs/backend/joint/02-DOMAIN-MODEL.md §2 and PHASE-3B-STEP1-NOTES.md.
-- Existing rows: userId NOT NULL / jointAccountId NULL → constraint passes
-- without any data rewrite; DROP NOT NULL above is a catalog-only change.
ALTER TABLE "portfolios"
  ADD CONSTRAINT "portfolios_exactly_one_owner_check"
  CHECK (("userId" IS NOT NULL) <> ("jointAccountId" IS NOT NULL));
-- ─────────────────────────────────────────────────────────────────────────────
