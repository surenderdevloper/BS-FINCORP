import assert from "node:assert/strict";
import test from "node:test";
import { planCarryForward, type CarryEmi } from "./carry-forward";

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

  // The settled month keeps only what was collected and is marked paid.
  assert.equal(plan.source.amount, 600);
  assert.equal(plan.source.status, "paid");
  assert.equal(plan.source.principal + plan.source.interest, plan.source.amount);

  // The next instalment absorbs the balance; the customer still owes the same.
  assert.equal(plan.target.amount, 1400);
  assert.equal(plan.target.principal + plan.target.interest, plan.target.amount);

  const totalBefore = first.amount + second.amount;
  const totalAfter = plan.source.amount + plan.target.amount;
  assert.equal(totalBefore, totalAfter);
});

test("principal and interest move with the balance so the loan stays balanced", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 250 });
  const second = emi({ _id: "e2", emiNo: 2, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.principalMoved + plan.interestMoved, plan.baseCarried);
  assert.equal(plan.source.principal, first.principal - plan.principalMoved);
  assert.equal(plan.source.interest, first.interest - plan.interestMoved);
});

test("penalty still due travels with the balance", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 600, penalty: 50 });
  const second = emi({ _id: "e2", emiNo: 2, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, second]);
  assert.ok(plan);
  assert.equal(plan.penaltyCarried, 50);
  assert.equal(plan.totalCarried, 450);
  assert.equal(plan.source.penalty, 0);
  assert.equal(plan.target.penalty, 50);
});

test("the balance goes to the earliest later unpaid instalment", () => {
  const first = emi({ _id: "e1", emiNo: 1, status: "partial", paidAmount: 600 });
  const paid = emi({ _id: "e2", emiNo: 2, status: "paid", paidAmount: 1000 });
  const third = emi({ _id: "e3", emiNo: 3, amount: 1000, principal: 800, interest: 200 });

  const plan = planCarryForward([first], [first, paid, third]);
  assert.ok(plan);
  assert.equal(plan.toEmiNo, 3);
});
