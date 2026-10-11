import { test } from "node:test";
import assert from "node:assert/strict";
import { allocatePayment, type AllocEmi } from "./payment-allocation";

const emi = (over: Partial<AllocEmi> = {}): AllocEmi => ({
  _id: over._id ?? "e1",
  amount: over.amount ?? 4618,
  principal: over.principal ?? 4000,
  interest: over.interest ?? 618,
  paidAmount: over.paidAmount ?? 0,
  status: over.status ?? "pending",
  penalty: over.penalty ?? 0,
});

const none = () => 0;

test("full cash payment marks the EMI paid", () => {
  const r = allocatePayment({ emis: [emi()], cash: 4618, discount: 0, advance: 0, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.emis[0].paidAmount, 4618);
  assert.equal(r.advanceAdded, 0);
  assert.equal(r.amount, 4618);
});

test("short payment leaves the EMI partial with a remaining balance", () => {
  const r = allocatePayment({ emis: [emi()], cash: 4000, discount: 0, advance: 0, penaltyFor: none });
  assert.equal(r.emis[0].status, "partial");
  assert.equal(r.emis[0].paidAmount, 4000);
  assert.equal(r.emis[0].appliedBase, 4000);
  assert.equal(r.advanceAdded, 0);
  assert.equal(r.amount, 4000);
});

test("overpayment fully pays the EMI and saves the excess as advance", () => {
  const r = allocatePayment({ emis: [emi()], cash: 5000, discount: 0, advance: 0, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.advanceAdded, 382);
  assert.equal(r.newAdvance, 382);
  assert.equal(r.amount, 5000);
});

test("discount clears the EMI without extra cash", () => {
  const r = allocatePayment({ emis: [emi()], cash: 4000, discount: 618, advance: 0, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.discount, 618);
  assert.equal(r.advanceAdded, 0);
  assert.equal(r.amount, 4000);
  // principal + interest + penalty - discount - advanceUsed = cash
  assert.equal(r.principal + r.interest + r.penalty - r.discount - r.advanceUsed, r.amount - r.advanceAdded);
});

test("existing advance is consumed before cash", () => {
  const r = allocatePayment({ emis: [emi()], cash: 4236, discount: 0, advance: 382, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.advanceUsed, 382);
  assert.equal(r.advanceAdded, 0);
  assert.equal(r.newAdvance, 0);
});

test("existing advance is untouched when cash already covers the EMI", () => {
  const r = allocatePayment({ emis: [emi()], cash: 4618, discount: 0, advance: 382, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.newAdvance, 382);
});

test("penalty is added to the amount due and collected", () => {
  const r = allocatePayment({
    emis: [emi({ penalty: 0 })],
    cash: 4718,
    discount: 0,
    advance: 0,
    penaltyFor: () => 100,
  });
  assert.equal(r.penalty, 100);
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.emis[0].penalty, 0);
  assert.equal(r.amount, 4718);
});

test("multi-EMI collection pays oldest first and can leave the last partial", () => {
  const emis = [emi({ _id: "a" }), emi({ _id: "b" })];
  const r = allocatePayment({ emis, cash: 5000, discount: 0, advance: 0, penaltyFor: none });
  assert.equal(r.emis[0].status, "paid");
  assert.equal(r.emis[1].status, "partial");
  assert.equal(r.emis[1].paidAmount, 382);
});
