import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toWhatsAppNumber,
  buildWhatsAppUrl,
  buildEmiReminderMessage,
  buildPaymentConfirmationMessage,
  buildCollectionFollowUpMessage,
  buildStatementMessage,
  buildCustomChatMessage,
} from "./whatsapp";

test("toWhatsAppNumber converts a valid Indian mobile to 91-prefixed digits", () => {
  assert.equal(toWhatsAppNumber("9876543210"), "919876543210");
  assert.equal(toWhatsAppNumber("+91 98765 43210"), "919876543210");
  assert.equal(toWhatsAppNumber("09876543210"), "919876543210");
});

test("toWhatsAppNumber rejects missing or invalid numbers", () => {
  assert.equal(toWhatsAppNumber(null), null);
  assert.equal(toWhatsAppNumber(""), null);
  assert.equal(toWhatsAppNumber("12345"), null);
  assert.equal(toWhatsAppNumber("5876543210"), null);
});

test("buildWhatsAppUrl encodes the message and omits empty text", () => {
  const url = buildWhatsAppUrl("919876543210", "नमस्ते, EMI ₹1,000 देय है।\nधन्यवाद");
  assert.ok(url.startsWith("https://wa.me/919876543210?text="));
  assert.ok(url.includes(encodeURIComponent("₹1,000")));
  assert.ok(url.includes("%0A"));
  assert.equal(buildWhatsAppUrl("919876543210", "   "), "https://wa.me/919876543210");
});

test("upcoming EMI reminder is Hindi with amount, date, loan and branding", () => {
  const msg = buildEmiReminderMessage("upcoming", {
    customerName: "Ramesh Kumar",
    loanNo: "BF-0001",
    amount: 1000,
    dueDate: "2026-10-15T00:00:00.000Z",
  });
  assert.match(msg, /Ramesh Kumar/);
  assert.match(msg, /₹1,000/);
  assert.match(msg, /15\/10\/2026/);
  assert.match(msg, /BF-0001/);
  assert.match(msg, /देय है/);
  assert.match(msg, /BS FINCORP/);
});

test("due-today and overdue reminders use the right wording", () => {
  const base = { customerName: "Asha", loanNo: "BF-0002", amount: 2500, dueDate: "2026-10-01T00:00:00.000Z" };
  assert.match(buildEmiReminderMessage("duetoday", base), /आज/);
  assert.match(buildEmiReminderMessage("overdue", base), /बकाया/);
});

test("overdue reminder shows the single EMI amount, not a summed balance", () => {
  const msg = buildEmiReminderMessage("overdue", {
    customerName: "Asha Devi",
    loanNo: "BF-0002",
    amount: 2500,
    dueDate: "2026-10-01T00:00:00.000Z",
  });
  assert.match(msg, /₹2,500/);
  assert.ok(!msg.includes("₹5,000"));
});

test("payment confirmation includes amount, date and receipt number", () => {
  const msg = buildPaymentConfirmationMessage({
    customerName: "Ramesh Kumar",
    amount: 4917,
    paidAt: "2026-10-10T06:00:00.000Z",
    receiptNo: "RCPT-0007",
    loanNo: "BF-0001",
  });
  assert.match(msg, /₹4,917/);
  assert.match(msg, /10\/10\/2026/);
  assert.match(msg, /RCPT-0007/);
  assert.match(msg, /BF-0001/);
});

test("collection follow-up variants are professional and include the phone when given", () => {
  const base = { customerName: "Sunita", loanNo: "BF-0003", amount: 1500, officePhone: "0141-2222333" };
  assert.match(buildCollectionFollowUpMessage("friendly", base), /विनम्र/);
  assert.match(buildCollectionFollowUpMessage("status", base), /किस तिथि/);
  assert.match(buildCollectionFollowUpMessage("contact_office", base), /0141-2222333/);
});

test("statement and custom chat messages fall back safely on an empty name", () => {
  assert.match(buildStatementMessage({ customerName: "", loanCount: 1, totalPaid: 0, outstanding: 0 }), /नमस्ते ग्राहक/);
  assert.match(buildCustomChatMessage(""), /नमस्ते ग्राहक/);
});
