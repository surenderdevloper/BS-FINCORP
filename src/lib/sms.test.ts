import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMobile, buildSmsMessage, buildSmsUrl, buildSmsUrlAlt, countSmsParts } from "./sms";

test("normalizeMobile accepts a plain 10-digit Indian number", () => {
  assert.equal(normalizeMobile("9876543210"), "9876543210");
});

test("normalizeMobile accepts +91 and 91 prefixes", () => {
  assert.equal(normalizeMobile("+91 98765 43210"), "9876543210");
  assert.equal(normalizeMobile("919876543210"), "9876543210");
});

test("normalizeMobile accepts a leading 0", () => {
  assert.equal(normalizeMobile("09876543210"), "9876543210");
});

test("normalizeMobile rejects missing or malformed numbers", () => {
  assert.equal(normalizeMobile(null), null);
  assert.equal(normalizeMobile(""), null);
  assert.equal(normalizeMobile("12345"), null);
  assert.equal(normalizeMobile("5876543210"), null);
  assert.equal(normalizeMobile("987654321"), null);
});

test("upcoming reminder is in Hindi with name, EMI amount, due date, loan and branding", () => {
  const msg = buildSmsMessage("upcoming", {
    customerName: "Ramesh Kumar",
    loanNo: "BF-0001",
    amount: 1000,
    dueDate: "2026-10-15T00:00:00.000Z",
  });
  assert.match(msg, /Ramesh Kumar/);
  assert.match(msg, /₹1,000/);
  assert.match(msg, /देय है/);
  assert.match(msg, /15\/10\/2026/);
  assert.match(msg, /BF-0001/);
  assert.match(msg, /BS FINCORP/);
});

test("overdue reminder shares the same EMI amount, not a summed balance", () => {
  const msg = buildSmsMessage("overdue", {
    customerName: "Asha Devi",
    loanNo: "BF-0002",
    amount: 2500,
    dueDate: "2026-10-01T00:00:00.000Z",
  });
  assert.match(msg, /₹2,500/);
  assert.match(msg, /बकाया/);
  assert.ok(!msg.includes("₹5,000"));
});

test("missing customer name falls back safely", () => {
  const msg = buildSmsMessage("upcoming", {
    customerName: "",
    loanNo: "BF-0003",
    amount: 500,
    dueDate: "2026-10-20T00:00:00.000Z",
  });
  assert.ok(msg.startsWith("नमस्ते ग्राहक"));
});

test("countSmsParts treats plain ASCII as GSM-7 (160 chars, one part)", () => {
  const info = countSmsParts("Your EMI is due soon. Please pay on time.");
  assert.equal(info.encoding, "gsm7");
  assert.equal(info.parts, 1);
});

test("countSmsParts treats Hindi / rupee messages as UCS-2 and splits by 67", () => {
  const short = countSmsParts("नमस्ते रमेश जी, आपकी EMI देय है।");
  assert.equal(short.encoding, "unicode");
  assert.equal(short.parts, 1);

  const long = countSmsParts("क".repeat(140));
  assert.equal(long.encoding, "unicode");
  assert.equal(long.parts, 3);
});

test("buildSmsUrl prefixes +91 and encodes the message body", () => {
  const url = buildSmsUrl("9876543210", "Hello Ramesh, EMI due!", "android");
  assert.equal(url, "sms:+919876543210?body=Hello%20Ramesh%2C%20EMI%20due!");
});

test("buildSmsUrl uses & separator on iOS and the alternate link swaps it", () => {
  const ios = buildSmsUrl("9876543210", "Reminder", "ios");
  assert.match(ios, /sms:\+919876543210&body=Reminder/);
  const alt = buildSmsUrlAlt("9876543210", "Reminder", "ios");
  assert.match(alt, /sms:\+919876543210\?body=Reminder/);
});