import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TIMEOUT_MS,
  WARNING_BEFORE_MS,
  MIN_ACTIVITY_INTERVAL_MS,
  evaluateState,
  shouldTrackActivity,
  computeNextDelay,
  resolveVisibilityAction,
} from "./session-timeout";

const WARNING_START = SESSION_TIMEOUT_MS - WARNING_BEFORE_MS;

test("fresh activity keeps the session idle", () => {
  assert.equal(evaluateState(0, 0), "idle");
});

test("activity just inside the idle window stays idle", () => {
  assert.equal(evaluateState(WARNING_START - 1, 0), "idle");
});

test("reaching the warning point shows the warning", () => {
  assert.equal(evaluateState(WARNING_START, 0), "warning");
  assert.equal(evaluateState(SESSION_TIMEOUT_MS - 1, 0), "warning");
});

test("reaching the timeout expires the session", () => {
  assert.equal(evaluateState(SESSION_TIMEOUT_MS, 0), "expired");
  assert.equal(evaluateState(SESSION_TIMEOUT_MS + 5000, 0), "expired");
});

test("evaluateState uses the supplied configuration values", () => {
  assert.equal(evaluateState(1500, 0, 2000, 500), "warning");
  assert.equal(evaluateState(1499, 0, 2000, 500), "idle");
  assert.equal(evaluateState(2000, 0, 2000, 500), "expired");
});

test("continuing the session resets the timer (last activity moves forward)", () => {
  const elapsedAfterContinue = evaluateState(SESSION_TIMEOUT_MS, SESSION_TIMEOUT_MS);
  assert.equal(elapsedAfterContinue, "idle");
  assert.equal(evaluateState(WARNING_START, SESSION_TIMEOUT_MS), "idle");
});

test("activity within the throttle window is not tracked again", () => {
  assert.equal(shouldTrackActivity(MIN_ACTIVITY_INTERVAL_MS - 1, 0), false);
  assert.equal(shouldTrackActivity(0, 0), false);
});

test("activity after the throttle window is tracked", () => {
  assert.equal(shouldTrackActivity(MIN_ACTIVITY_INTERVAL_MS, 0), true);
  assert.equal(shouldTrackActivity(MIN_ACTIVITY_INTERVAL_MS + 1000, 0), true);
});

test("normal activity repeatedly prevents timeout", () => {
  let lastActivity = 0;
  const tick = (now: number) => {
    if (shouldTrackActivity(now, lastActivity)) lastActivity = now;
    return evaluateState(now, lastActivity);
  };
  const steps = [0, 6000, 12000, 18000, 24000];
  for (const at of steps) {
    assert.equal(tick(at), "idle", `expected idle at ${at}`);
  }
  let now = 24000;
  for (let step = 0; step < 100; step += 1) {
    now += 30000;
    assert.equal(tick(now), "idle");
  }
});

test("an idle user eventually rejects and then expires", () => {
  const lastActivity = 0;
  const states: string[] = [];
  for (let now = 0; now <= SESSION_TIMEOUT_MS + 1000; now += 1000) {
    states.push(evaluateState(now, lastActivity));
  }
  assert.equal(states.includes("warning"), true);
  assert.equal(states.includes("expired"), true);
  assert.equal(states.indexOf("warning") < states.indexOf("expired"), true);
});

test("sample config values are consistent", () => {
  assert.ok(WARNING_BEFORE_MS > 0 && WARNING_BEFORE_MS < SESSION_TIMEOUT_MS);
  assert.ok(MIN_ACTIVITY_INTERVAL_MS > 0 && MIN_ACTIVITY_INTERVAL_MS < WARNING_BEFORE_MS);
});

test("warning-state scheduler next delay is never a sub-second spin", () => {
  const lastActivity = 0;
  const warningStart = SESSION_TIMEOUT_MS - WARNING_BEFORE_MS;
  // A fresh warning with ~1 minute left until the session is expired.
  assert.equal(computeNextDelay(true, warningStart, lastActivity), 1000);
  // Mid-warning with ~30 seconds left.
  assert.equal(computeNextDelay(true, warningStart + 30_000, lastActivity), 1000);
  // Just before expiry: delay tightens to the remaining sub-second amount, never 1ms.
  const remaining = 750;
  assert.equal(computeNextDelay(true, SESSION_TIMEOUT_MS - remaining, lastActivity), remaining);
  // The target for a warned schedule is the expiry boundary, so any positive remainder is used.
  assert.ok(computeNextDelay(true, warningStart + 2000, lastActivity) >= 1000);
});

test("idle-state scheduler waits toward the warning boundary", () => {
  const lastActivity = 0;
  // Plenty of idle time left: the delay is capped at 1000ms so the state machine stays responsive.
  assert.equal(computeNextDelay(false, 0, lastActivity), 1000);
  // Distant idle: still capped at 1000ms, never a sub-second wakeup churn.
  assert.equal(computeNextDelay(false, 5 * 60_000, lastActivity), 1000);
  // Approaching the warning boundary, the delay lands exactly on it.
  assert.equal(computeNextDelay(false, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS - 10_000, lastActivity), 1000);
});

test("visibility return after timeout is evaluated as logout, not activity reset", () => {
  const lastActivity = 0;
  assert.equal(resolveVisibilityAction(SESSION_TIMEOUT_MS, lastActivity), "logout");
  assert.equal(resolveVisibilityAction(SESSION_TIMEOUT_MS + 5000, lastActivity), "logout");
});

test("visibility return before timeout still records activity normally", () => {
  const lastActivity = 0;
  assert.equal(resolveVisibilityAction(0, lastActivity), "recordActivity");
  assert.equal(resolveVisibilityAction(20 * 60_000, lastActivity), "recordActivity");
  assert.equal(resolveVisibilityAction(SESSION_TIMEOUT_MS - 1000, lastActivity), "recordActivity");
});