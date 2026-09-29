import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";

export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
export const GENERIC_RESET_MESSAGE =
  "If an account exists with this information, you will receive password reset instructions.";
export const EMAIL_RATE_LIMIT_MAX = 5;
export const IP_RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function validateNewPassword(
  password: string,
  confirm: string
): { field: "password" | "confirm"; error: string } | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      field: "password",
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirm) {
    return { field: "confirm", error: "Passwords do not match." };
  }
  return null;
}

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now()
  ) {}

  allow(key: string): boolean {
    const current = this.now();
    const cutoff = current - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(current);
    this.hits.set(key, recent);
    this.sweepIfDue();
    return true;
  }

  private sweepIfDue(): void {
    if (this.hits.size % 200 !== 0) return;
    const cutoff = this.now() - this.windowMs;
    for (const [key, stamps] of this.hits) {
      const live = stamps.filter((t) => t > cutoff);
      if (live.length === 0) this.hits.delete(key);
      else this.hits.set(key, live);
    }
  }
}

export const emailResetLimiter = new SlidingWindowLimiter(EMAIL_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
export const ipResetLimiter = new SlidingWindowLimiter(IP_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

export async function createPasswordReset(
  userId: Types.ObjectId | string,
  now: Date = new Date()
): Promise<string> {
  const token = generateResetToken();
  await PasswordReset.create({
    user: userId,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  });
  return token;
}

export async function createResetForUserIfExists(
  email: string,
  resetBaseUrl: string
): Promise<string | null> {
  const user = await User.findOne({ email }).select("_id email").lean();
  if (!user) return null;
  const token = await createPasswordReset(user._id);
  const base = resetBaseUrl.replace(/\/+$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function claimPasswordReset(
  token: string | null | undefined
): Promise<Types.ObjectId | null> {
  if (!token) return null;
  const record = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" }
  );
  return record ? record.user : null;
}

export async function changeUserPassword(
  userId: Types.ObjectId,
  newPassword: string
): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await PasswordReset.deleteMany({ user: user._id });
  return true;
}