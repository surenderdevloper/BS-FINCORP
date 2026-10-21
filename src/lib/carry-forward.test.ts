import assert from "node:assert/strict";
import test from "node:test";
import { emiTotalDue, planCarryForward, type CarryEmi } from "./carry-forward";

function emi(over: Partial<CarryEmi> = {}): CarryEmi {
  return {
    _id: over._id ?? "e1",
    emiNo: over.emiNo ?? 1,
    amount: over.amount ?? 1000,
    principal: over.principal ?? 800,
    interest: over.interest ?? 200,
    paidAmount: over.paidAmount ?? 0,
    status: over.status ?? "pending",
    penalty: over.penalty ?? 0,
    carriedInAmount: over.carriedInAmount ?? 0,
    carriedInPrincipal: over.carriedInPrincipal ?? 0,
    carriedInInterest: over.carriedInInterest ?? 0,
    carriedInPenalty: over.carriedInPenalty ?? 0,
  };
}

test("nothing is carried when the instalment is fully covered", () => {
  const covered = emi({ status: "paid", paidAmount: 1000 });
  assert.equal(planCarryForward([covered], [covered, emi({ _id: "e2", emiNo: 2 })]), null);
});

test("nothing is carried when the loan has no later unpaid EMI", () => {
  const short = emi({ status: "partial", paidAmount: 600 });
  assert.equal(planCarryForward([short], [short]), null);
});

test("shortfall moves to the next instalment and settles the current month", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 600 });
  const second = emi({ _id: "e2", emiNo: 2, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.fromEmiNo, 1);
  assert.equal(plan.toEmiNo, 2);
  assert.equal(plan.baseCarried, 400);
  assert.equal(plan.totalCarried, 400);

  // The settled month keeps its decided schedule untouched.
  assert.equal(first.amount, 1000);
  assert.equal(first.principal, 800);
  assert.equal(first.interest, 200);
  assert.equal(plan.source.status, "paid");
  assert.equal(plan.source.carriedForward, 400);

  // The next instalment keeps its decided amount and absorbs the balance
  // in its separate carry-in bucket.
  assert.equal(second.amount, 1000);
  assert.equal(plan.target.carriedInAmount, 400);
  assert.equal(plan.target.carriedInPrincipal + plan.target.carriedInInterest, 400);
  assert.equal(emiTotalDue({ ...second, ...plan.target }), 1400);

  // The customer's total obligation is unchanged.
  const totalBefore = first.amount + second.amount;
  const totalAfter = first.amount + second.amount;
  assert.equal(totalBefore, totalAfter);
});

test("principal and interest move with the balance so the loan stays balanced", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 250 });
  const second = emi({ _id: "e2", emiNo: 2, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.principalMoved + plan.interestMoved, plan.baseCarried);
  assert.equal(plan.principalMoved, 600);
  assert.equal(plan.interestMoved, 150);
  assert.equal(plan.target.carriedInPrincipal, plan.principalMoved);
  assert.equal(plan.target.carriedInInterest, plan.interestMoved);
});

test("penalty still due travels with the balance", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 600, penalty: 50 });
  const second = emi({ _id: "e2", emiNo: 2, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.penaltyCarried, 50);
  assert.equal(plan.totalCarried, 450);
  assert.equal(plan.source.penalty, 0);
  assert.equal(plan.target.carriedInPenalty, 50);
});

test("a balance already carried into the source travels on as well", () => {
  // Decided 1000 + 300 carried in = 1300 payable, of which 1100 collected.
  const first = emi({
    _id: "e1",
    emiNo: 1,
    status: "partial",
    paidAmount: 1100,
    carriedInAmount: 300,
    carriedInPrincipal: 200,
    carriedInInterest: 100,
  });
  const second = emi({
    _id: "e2",
    emiNo: 2,
    amount: 1000,
    principal: 800,
    interest: 200,
    carriedInAmount: 100,
  });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.baseCarried, 200);
  assert.equal(plan.target.carriedInAmount, 300);
  // Mix of the source's full payable: 1000 principal / 300 interest.
  assert.equal(plan.principalMoved, 154);
  assert.equal(plan.interestMoved, 46);
});

test("the balance goes to the earliest later unpaid instalment", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 600 });
  const paid = emi({ _id: "e2", emiNo: 2, status: "paid", paidAmount: 1000 });
  const third = emi({ _id: "e3", emiNo: 3, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, paid, third]);
  assert.ok(plan);
  assert.equal(plan.toEmiNo, 3);
});
