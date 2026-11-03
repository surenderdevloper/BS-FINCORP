import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIPTION_WARNING_DAYS,
  buildSubscriptionNotice,
} from "./subscription-notice";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-01T00:00:00.000Z").getTime();
const daysFromNow = (days: number) => new Date(NOW + days * DAY_MS);

test("no expiry date means no notice", () => {
  assert.equal(buildSubscriptionNotice(null, NOW), null);
  assert.equal(buildSubscriptionNotice(undefined, NOW), null);
});

test("an invalid expiry date means no notice", () => {
  assert.equal(buildSubscriptionNotice("not-a-date", NOW), null);
});

test("far-away expiry stays hidden", () => {
  assert.equal(buildSubscriptionNotice(daysFromNow(SUBSCRIPTION_WARNING_DAYS + 1), NOW), null);
});

test("the warning window starts at the threshold day", () => {
  assert.deepEqual(buildSubscriptionNotice(daysFromNow(SUBSCRIPTION_WARNING_DAYS), NOW), {
    daysLeft: SUBSCRIPTION_WARNING_DAYS,
    tone: "amber",
  });
});

test("partial days round up so the banner never understates the time left", () => {
  assert.deepEqual(buildSubscriptionNotice(new Date(NOW + 5.2 * DAY_MS), NOW), {
    daysLeft: 6,
    tone: "amber",
  });
});

test("less than a day left turns the notice red", () => {
  assert.deepEqual(buildSubscriptionNotice(new Date(NOW + 0.5 * DAY_MS), NOW), {
    daysLeft: 1,
    tone: "red",
  });
});

test("an expired subscription has no notice (the suspended flow takes over)", () => {
  assert.equal(buildSubscriptionNotice(new Date(NOW - DAY_MS), NOW), null);
  assert.equal(buildSubscriptionNotice(new Date(NOW), NOW), null);
});
