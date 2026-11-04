# 02 — Proposed Domain Model (REVISED — review required, NO migration written)

## 1. Identity vs account separation [recommendation, pending approval]

```
User ───────────── login identity (email + argon2id password, sessions, refresh
  │                tokens). [EXISTING — unchanged]
  │  JointAccountMember (ACTIVE-only join row)            [PROPOSED]
  ▼
JointAccount ──── shared account; max 2 ACTIVE members; owns ≤1 Portfolio
                   via the revised Portfolio ownership link            [PROPOSED]
```

## 2. Reviewed Portfolio ownership change (Option B) [recommendation, J-01]

The existing `Portfolio.userId` is **required + unique**. Option B therefore
requires an explicit column-level change, documented precisely here — just
"add nullable jointAccountId" is insufficient because a required `userId`
would still block joint-owned rows.

### 2.1 Proposed Prisma model definitions

Existing `User` / `InvestorProfile` / `Holding` / `Transaction` / auth models:
**unchanged**. Revised `Portfolio` and new models:

```prisma
/// Phase 3A proposal. Exactly one owner, enforced by DB:
///   (userId IS NOT NULL) <> (jointAccountId IS NOT NULL)
/// Individual rows: userId set, jointAccountId NULL — behavior IDENTICAL to today.
/// Joint rows:      jointAccountId set, userId NULL.
model Portfolio {
  id             String        @id @default(uuid()) @db.Uuid
  /// NOW NULLABLE (was required). Uniqueness preserved on the column.
  user           User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String?       @unique @db.Uuid
  /// NEW — nullable unique FK to the joint owner.
  jointAccount   JointAccount? @relation(fields: [jointAccountId], references: [id], onDelete: Restrict)
  jointAccountId String?       @unique @db.Uuid
  holdings       Holding[]
  transactions   Transaction[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@map("portfolios")
}

model JointAccount {
  id          String  @id @default(uuid()) @db.Uuid
  /// Optional display label chosen at creation; never personal data beyond names.
  displayName String  @db.VarChar(60)
  /// Initiating holder — AUDIT field only; authorization derives from membership rows.
  createdBy     User     @relation("CreatedJointAccounts", fields: [createdByUserId], references: [id])
  createdByUserId String  @db.Uuid
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     JointAccountMember[]
  invitations JointAccountInvitation[]
  portfolio   Portfolio?

  @@map("joint_accounts")
}

/// ACTIVE memberships ONLY. Pending relationships live in invitations.
model JointAccountMember {
  id             String       @id @default(uuid()) @db.Uuid
  jointAccount   JointAccount @relation(fields: [jointAccountId], references: [id], onDelete: Cascade)
  jointAccountId String       @db.Uuid
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String       @db.Uuid
  joinedAt       DateTime     @default(now())
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  /// No duplicate memberships — hard constraint, race-safe.
  @@unique([jointAccountId, userId])
  @@index([userId])
  @@map("joint_account_members")
}

/// Simplified MVP invitation (REVIEW CORRECTION): login-only inbox.
/// No bearer tokenHash / attempt-count machinery (removed — see doc 04 §3).
/// Recipient proof: server-side lookup of the accepting user's CURRENT record —
/// accept requires normalizedEmail == invitedEmailNormalized AND emailVerifiedAt
/// set, read from the DB row found via the session principal (userId/sessionId);
/// the caller's normalizedEmail is NOT a JWT claim and never taken from requests.
/// Email values ARE stored (plaintext invitedEmail is required for delivery);
/// API responses mask them — storage is NOT claimed to be hash-only.
/// PG mapping: Prisma enum → native PostgreSQL enum "joint_invitation_status".
enum JointInvitationStatus { PENDING ACCEPTED DECLINED EXPIRED REVOKED }

model JointAccountInvitation {
  id                      String   @id @default(uuid()) @db.Uuid
  jointAccount            JointAccount @relation(fields: [jointAccountId], references: [id], onDelete: Cascade)
  jointAccountId          String   @db.Uuid
  /// Lowercase compare value, mirroring User.normalizedEmail normalization.
  invitedEmailNormalized  String
  /// Stored plaintext (needed for delivery); always masked in API responses.
  invitedEmail            String
  /// FK to User under named relation (multiple User FKs on this model).
  invitedBy               User     @relation("SentJointInvitations", fields: [invitedByUserId], references: [id])
  invitedByUserId         String   @db.Uuid
  /// Set at acceptance — enables idempotent authorized replay (doc 03 §3).
  acceptedBy              User?    @relation("AcceptedJointInvitations", fields: [acceptedByUserId], references: [id])
  acceptedByUserId        String?  @db.Uuid
  status                  JointInvitationStatus @default(PENDING)
  expiresAt               DateTime
  respondedAt             DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  /// Inbox lookup + "single live pending invitation per account" scans.
  @@index([invitedEmailNormalized, status])
  @@index([jointAccountId, status])
  @@map("joint_account_invitations")
}
```

`User` back-relations added (NO scalar columns — `/me` response shape cannot drift):
`jointMemberships JointAccountMember[]`, `createdJointAccounts JointAccount[]
@relation("CreatedJointAccounts")`, `sentJointInvitations JointAccountInvitation[]
@relation("SentJointInvitations")`, `acceptedJointInvitations JointAccountInvitation[]
@relation("AcceptedJointInvitations")`.

### 2.2 Illustrative migration SQL (review only — NOT created/executed)

```sql
-- 1) New tables
CREATE TABLE "joint_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "display_name" VARCHAR(60) NOT NULL,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "joint_account_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "joint_account_id" UUID NOT NULL REFERENCES "joint_accounts"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  UNIQUE ("joint_account_id", "user_id")
);
CREATE INDEX "jam_user_idx" ON "joint_account_members"("user_id");
-- Prisma enums map to native PostgreSQL enum types
CREATE TYPE "joint_invitation_status" AS ENUM ('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED');
CREATE TABLE "joint_account_invitations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "joint_account_id" UUID NOT NULL REFERENCES "joint_accounts"("id") ON DELETE CASCADE,
  "invited_email_normalized" TEXT NOT NULL,
  "invited_email" TEXT NOT NULL,   -- plaintext (delivery); masked in API responses
  "invited_by_user_id" UUID NOT NULL REFERENCES "users"("id"),
  "accepted_by_user_id" UUID REFERENCES "users"("id"),
  "status" "joint_invitation_status" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "responded_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "jai_email_idx" ON "joint_account_invitations"("invited_email_normalized","status");
CREATE INDEX "jai_account_idx" ON "joint_account_invitations"("joint_account_id","status");

-- 2) Portfolio ownership: required userId → nullable; add joint link; XOR owner
ALTER TABLE "portfolios" ALTER COLUMN "user_id" DROP NOT NULL;      -- existing UNIQUE constraint stays
ALTER TABLE "portfolios" ADD COLUMN "joint_account_id" UUID
  REFERENCES "joint_accounts"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "portfolios_joint_account_id_key" ON "portfolios"("joint_account_id");
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_exactly_one_owner_check"
  CHECK (("user_id" IS NOT NULL) <> ("joint_account_id" IS NOT NULL));
```

**Existing-row safety**: all current rows have `user_id NOT NULL, joint_account_id
NULL` → XOR CHECK passes; `DROP NOT NULL` + optional FK are metadata-only and
instant (no table rewrite — PostgreSQL catalog changes); the existing
`portfolios_user_id_key` unique constraint **remains**, so the 1:1
individual-user↔portfolio rule is unchanged.

### 2.3 Why `onDelete: Restrict` on the joint link

Deleting a `JointAccount` while it owns financial records must be impossible at
DB level (audit integrity). MVP has no account-deletion flow anyway; Restrict
codifies that.

### 2.4 Rollback procedure (honest version)

- **If NO joint rows exist:** reversible — drop the CHECK/column/tables; re-add
  `NOT NULL` on `user_id` (passes vacuously). Zero data loss.
- **If joint members/invitations exist but no joint portfolio rows:** dropping
  joint tables **destroys those membership/invitation records** (targeted,
  declared data loss — acceptable only with explicit approval).
- **If a joint portfolio exists:** rollback requires either deleting the joint
  portfolio (destroys financial records + cascades to holdings/transactions —
  NOT acceptable without business sign-off) or re-attaching ownership to a
  single user (a fabricated ownership change — prohibited). **Practical rule:
  once real joint-owned financial rows exist, rollback stops being a schema
  rollback and becomes a business-archival decision.** This is stated, not
  hidden.

## 3. Simplified invitation model — review correction applied

Per review §3: login-only inbox. Removed from the earlier MVP draft:
`tokenHash`, token attempt counters, `?token=` accept path. The email now
carries only a link to the login/invitations page — **no authorization
material in email**. Failed-delivery/replacement/expiry handling is documented
in doc 04 §4–§6.

## 4. Role decision (unchanged from review acceptance)

Keep `INVESTOR` as the only customer role; joint access = membership data, not a
role (rationale retained in §"Why no JOINT role"). [J-02 recommendation]
