import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, inr } from "./money";
import { isValidMobile, validateCustomerShape } from "./validators";
import { normalizeMobile } from "./sms";
import { toWhatsAppNumber } from "./whatsapp";

test("formatCurrency handles Indian Rupees with Indian grouping by default", () => {
  assert.equal(formatCurrency(100000, "INR", "₹"), "₹1,00,000");
  assert.equal(inr(100000), "₹1,00,000");
  assert.equal(formatCurrency(2922, "INR", "₹"), "₹2,922");
  assert.equal(formatCurrency(0, "INR", "₹"), "₹0");
});

test("formatCurrency formats international currencies cleanly", () => {
  // USD
  const usd = formatCurrency(1500, "USD", "$");
  assert.ok(usd.includes("1,500"));
  assert.ok(usd.includes("$"));

  // KES (Kenya)
  const kes = formatCurrency(50000, "KES", "KES");
  assert.ok(kes.includes("50,000"));
  assert.ok(kes.includes("KES"));

  // NGN (Nigeria)
  const ngn = formatCurrency(250000, "NGN", "₦");
  assert.ok(ngn.includes("250,000"));
  assert.ok(ngn.includes("₦"));

  // AED (UAE)
  const aed = formatCurrency(10000, "AED", "AED");
  assert.ok(aed.includes("10,000"));
  assert.ok(aed.includes("AED"));
});

test("isValidMobile retains strict Indian 10-digit validation for India (91)", () => {
  assert.equal(isValidMobile("9876543210", "91"), true);
  assert.equal(isValidMobile("8123456789", "91"), true);
  assert.equal(isValidMobile("7012345678", "91"), true);
  assert.equal(isValidMobile("6901234567", "91"), true);

  // Invalid Indian numbers
  assert.equal(isValidMobile("5123456789", "91"), false); // does not start with 6-9
  assert.equal(isValidMobile("987654321", "91"), false); // 9 digits
  assert.equal(isValidMobile("98765432100", "91"), false); // 11 digits
});

test("isValidMobile validates international mobile numbers for non-Indian dial codes", () => {
  // Kenya (+254, 9 digits usually, e.g. 712345678)
  assert.equal(isValidMobile("712345678", "254"), true);
  assert.equal(isValidMobile("254712345678", "254"), true);

  // US (+1, 10 digits e.g. 2025550123)
  assert.equal(isValidMobile("2025550123", "1"), true);

  // UK (+44, 10 digits e.g. 7911123456)
  assert.equal(isValidMobile("7911123456", "44"), true);

  // Reject too short or too long
  assert.equal(isValidMobile("12345", "254"), false);
  assert.equal(isValidMobile("12345678901234567", "254"), false);
});

test("toWhatsAppNumber formats Indian numbers with 91 prefix", () => {
  assert.equal(toWhatsAppNumber("9876543210", "91"), "919876543210");
  assert.equal(toWhatsAppNumber("+91 98765-43210", "91"), "919876543210");
  assert.equal(toWhatsAppNumber("09876543210", "91"), "919876543210");
});

test("toWhatsAppNumber formats international numbers with their country dial code", () => {
  // Kenya (+254)
  assert.equal(toWhatsAppNumber("712345678", "254"), "254712345678");
  assert.equal(toWhatsAppNumber("+254 712345678", "254"), "254712345678");

  // US (+1)
  assert.equal(toWhatsAppNumber("2025550123", "1"), "12025550123");
  assert.equal(toWhatsAppNumber("+1 (202) 555-0123", "1"), "12025550123");
});

test("normalizeMobile handles Indian and international numbers cleanly", () => {
  // India (default 91)
  assert.equal(normalizeMobile("9876543210", "91"), "9876543210");
  assert.equal(normalizeMobile("+91 98765 43210", "91"), "9876543210");

  // Kenya (254)
  assert.equal(normalizeMobile("+254 712 345 678", "254"), "712345678");
  assert.equal(normalizeMobile("712345678", "254"), "712345678");
});

test("validateCustomerShape respects international dialCode", () => {
  const indianCustomer = {
    name: "Ramesh Sharma",
    mobile: "9876543210",
  };
  const indResult = validateCustomerShape(indianCustomer, "91");
  assert.equal(Object.keys(indResult).length, 0);

  const kenyanCustomer = {
    name: "John Kamau",
    mobile: "712345678",
  };
  const keResult = validateCustomerShape(kenyanCustomer, "254");
  assert.equal(Object.keys(keResult).length, 0);

  // Invalid customer in Kenya
  const invalidKe = validateCustomerShape({ name: "", mobile: "123" }, "254");
  assert.ok(invalidKe.name);
  assert.ok(invalidKe.mobile);
});
