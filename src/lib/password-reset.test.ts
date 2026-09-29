import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  RESET_TOKEN_TTL_MS,
  EMAIL_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  validateNewPassword,
  generateResetToken,
  hashResetToken,
  SlidingWindowLimiter,
} from "./password-reset";
import {
  createPasswordReset,
  createResetForUserIfExists,
  claimPasswordReset,
  changeUserPassword,
} from "./password-reset";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";
import { isSmtpConfigured } from "./email";

let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test("reset request for an existing account produces a reset record and link", async () => {
  const user = await User.create({
    name: "Test Admin",
    email: "reset-exists@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
  });

  const url = await createResetForUserIfExists(user.email, "http://localhost:3000/");

  assert.ok(url, "expected a reset URL");
  assert.equal(url.startsWith("http://localhost:3000/reset-password?token="), true);
  assert.equal(await PasswordReset.countDocuments({ user: user._id }), 1);

  const token = url.split("token=")[1];
  const claimed = await claimPasswordReset(token);
  assert.equal(claimed?.toString(), user._id.toString());
});

test("non-existing account does not reveal existence (no record, null link)", async () => {
  const beforeCount = await PasswordReset.countDocuments();
  const url = await createResetForUserIfExists("nobody@bsfincorp.com", "http://localhost:3000");
  assert.equal(url, null);
  assert.equal(await PasswordReset.countDocuments(), beforeCount);
});

test("invalid, empty and malformed tokens are rejected", async () => {
  assert.equal(await claimPasswordReset(null), null);
  assert.equal(await claimPasswordReset(undefined), null);
  assert.equal(await claimPasswordReset(""), null);
  assert.equal(await claimPasswordReset("not-a-real-token"), null);
});

test("expired token is rejected", async () => {
  const user = await User.create({
    name: "Expired Owner",
    email: "reset-expired@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
  });
  const past = new Date(Date.now() - RESET_TOKEN_TTL_MS - 5000);
  const token = await createPasswordReset(user._id, past);
  assert.equal(await claimPasswordReset(token), null);
});

test("reset token is single-use", async () => {
  const user = await User.create({
    name: "Single User",
    email: "reset-single@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
  });
  const token = await createPasswordReset(user._id);

  const first = await claimPasswordReset(token);
  assert.equal(first?.toString(), user._id.toString());

  const second = await claimPasswordReset(token);
  assert.equal(second, null);
});

test("successful password change invalidates the old password and bumps tokenVersion", async () => {
  const user = await User.create({
    name: "Change Owner",
    email: "reset-change@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
    tokenVersion: 0,
  });
  const token = await createPasswordReset(user._id);
  await claimPasswordReset(token);

  const changed = await changeUserPassword(user._id, "new-password-123");
  assert.equal(changed, true);

  const reloaded = await User.findById(user._id);
  assert.ok(reloaded);
  assert.equal(await bcrypt.compare("new-password-123", reloaded.passwordHash), true);
  assert.equal(await bcrypt.compare("old-password", reloaded.passwordHash), false);
  assert.equal(reloaded.tokenVersion, 1);
});

test("a used token cannot be reused after the password changed", async () => {
  const user = await User.create({
    name: "Reuse Guard",
    email: "reset-reuse@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
  });
  const token = await createPasswordReset(user._id);
  await claimPasswordReset(token);
  await changeUserPassword(user._id, "fresh-password-123");

  assert.equal(await claimPasswordReset(token), null);
});

test("outstanding unused reset tokens are invalidated after a password change", async () => {
  const user = await User.create({
    name: "Stale Token Owner",
    email: "reset-stale@bsfincorp.com",
    passwordHash: await bcrypt.hash("old-password", 10),
  });
  const staleToken = await createPasswordReset(user._id);
  const activeToken = await createPasswordReset(user._id);

  const claimed = await claimPasswordReset(activeToken);
  assert.equal(claimed?.toString(), user._id.toString());

  const changed = await changeUserPassword(user._id, "fresh-password-456");
  assert.equal(changed, true);

  assert.equal(await PasswordReset.countDocuments({ user: user._id }), 0);
  assert.equal(await claimPasswordReset(staleToken), null);
});

test("password policy enforces minimum length and confirmation match", () => {
  const short = validateNewPassword("1234567", "1234567");
  assert.equal(short?.field, "password");

  const mismatch = validateNewPassword("12345678", "87654321");
  assert.equal(mismatch?.field, "confirm");

  assert.equal(validateNewPassword("12345678", "12345678"), null);
});

test("reset tokens are unpredictable and only their hashes are stored", () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.equal(hashResetToken(a), hashResetToken(a));
  assert.notEqual(hashResetToken(a), a);
});

test("rate limiter allows the window limit and blocks the next request", () => {
  const clock = 0;
  const limiter = new SlidingWindowLimiter(
    EMAIL_RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    () => clock
  );

  for (let i = 0; i < EMAIL_RATE_LIMIT_MAX; i += 1) {
    assert.equal(limiter.allow("reset:test@bsfincorp.com"), true);
  }
  assert.equal(limiter.allow("reset:test@bsfincorp.com"), false);
});

test("rate limiter frees capacity after the window elapses", () => {
  let clock = 0;
  const limiter = new SlidingWindowLimiter(1, RATE_LIMIT_WINDOW_MS, () => clock);

  assert.equal(limiter.allow("reset:freed@bsfincorp.com"), true);
  assert.equal(limiter.allow("reset:freed@bsfincorp.com"), false);

  clock = RATE_LIMIT_WINDOW_MS + 1;
  assert.equal(limiter.allow("reset:freed@bsfincorp.com"), true);
});

test("isSmtpConfigured reflects SMTP environment configuration", () => {
  const prev = {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
  try {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    assert.equal(isSmtpConfigured(), false);

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "sender";
    process.env.SMTP_PASS = "secret";
    assert.equal(isSmtpConfigured(), true);
  } finally {
    if (prev.host === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = prev.host;
    if (prev.user === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = prev.user;
    if (prev.pass === undefined) delete process.env.SMTP_PASS;
    else process.env.SMTP_PASS = prev.pass;
  }
});