/** Show the renewal banner once this many days (or fewer) remain. */
export const SUBSCRIPTION_WARNING_DAYS = 10;

export type SubscriptionTone = "amber" | "red";

export interface SubscriptionNotice {
  /** Whole days remaining; never below 0. */
  daysLeft: number;
  tone: SubscriptionTone;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the in-app renewal notice for a tenant's subscription expiry date.
 *
 * Returns null when there is no expiry (lifetime plan), when the date is
 * invalid, when the subscription has already lapsed (the request is blocked by
 * the suspended-account flow instead), or when more than
 * SUBSCRIPTION_WARNING_DAYS remain.
 */
export function buildSubscriptionNotice(
  expiresAt: Date | string | null | undefined,
  now: number = Date.now()
): SubscriptionNotice | null {
  if (!expiresAt) return null;
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const msLeft = expires.getTime() - now;
  if (Number.isNaN(msLeft) || msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  if (daysLeft > SUBSCRIPTION_WARNING_DAYS) return null;
  return { daysLeft, tone: daysLeft <= 1 ? "red" : "amber" };
}
