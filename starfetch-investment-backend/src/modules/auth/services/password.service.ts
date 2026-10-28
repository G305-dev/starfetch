import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Approved Phase 2B password policy (passphrase-friendly, no composition rules). */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Approved Argon2id parameters (>= contract minimums 19456 KiB / t=2 / p=1).
 * Implementation: `argon2` (Node native binding to libargon2) — see
 * docs/backend/auth/AUTH-SECURITY-CONTRACT-v1.md for the pinned version.
 */
export const ARGON2_PARAMS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  /** Precomputed dummy hash used to equalize timing for unknown accounts. */
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_PARAMS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Verifies against the real hash, or — when the account does not exist —
   * against a dummy Argon2id hash so the response time does not reveal
   * whether the email is registered.
   */
  async verifyOrEqualize(hash: string | undefined, plain: string): Promise<boolean> {
    if (hash) return this.verify(hash, plain);
    if (!this.dummyHash) {
      this.dummyHash = argon2.hash('starfetch-timing-equalization-dummy', ARGON2_PARAMS);
    }
    await this.verify(await this.dummyHash, plain);
    return false;
  }
}
