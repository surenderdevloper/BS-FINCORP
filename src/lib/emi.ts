export type InterestType = "flat" | "reducing";

export interface LoanSummaryInput {
  principal: number;
  interestRate: number;
  tenureMonths: number;
  interestType: InterestType;
}

export interface LoanSummary {
  monthlyEmi: number;
  totalPayable: number;
  totalInterest: number;
}

export interface ScheduleRow {
  emiNo: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
}

const round = (n: number) => Math.round(n);

/**
 * Calculates monthly EMI under two schemes:
 * - flat:      simple interest over the full tenure, principal split equally.
 * - reducing:  standard amortization (formula EMI = P·r·(1+r)^n / ((1+r)^n − 1),
 *              r = annual rate / 12).
 */
export function calcLoanSummary({
  principal,
  interestRate,
  tenureMonths,
  interestType,
}: LoanSummaryInput): LoanSummary {
  if (tenureMonths <= 0) return { monthlyEmi: 0, totalPayable: 0, totalInterest: 0 };

  let monthlyEmi: number;
  let totalPayable: number;
  let totalInterest: number;

  if (interestType === "flat") {
    totalInterest = round((principal * interestRate * (tenureMonths / 12)) / 100);
    totalPayable = principal + totalInterest;
    monthlyEmi = round(totalPayable / tenureMonths);
  } else {
    const monthlyRate = interestRate / 100 / 12;
    if (monthlyRate === 0) {
      monthlyEmi = round(principal / tenureMonths);
    } else {
      const factor = Math.pow(1 + monthlyRate, tenureMonths);
      monthlyEmi = round((principal * monthlyRate * factor) / (factor - 1));
    }
    totalPayable = monthlyEmi * tenureMonths;
    totalInterest = totalPayable - principal;
  }
  return { monthlyEmi, totalPayable, totalInterest };
}

/** Adds `months` to a date while clamping the day to the target month's length. */
function addMonthsUtc(date: Date, months: number, dayOfMonth: number): Date {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endOfTarget = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months + 1, 0)
  ).getUTCDate();
  const day = Math.min(dayOfMonth, endOfTarget);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, day));
}

/**
 * Builds the full amortization schedule. First EMI falls due one month after the
 * loan start date, on the configured EMI day-of-month ("EMI Date").
 */
export function generateSchedule(input: {
  principal: number;
  interestRate: number;
  tenureMonths: number;
  interestType: InterestType;
  startDate: string;
  emiDay: number;
}): ScheduleRow[] {
  const {
    principal,
    interestRate,
    tenureMonths,
    interestType,
    startDate,
    emiDay,
  } = input;

  const summary = calcLoanSummary(input);
  const start = new Date(`${startDate}T00:00:00Z`);
  const rows: ScheduleRow[] = [];

  if (interestType === "flat") {
    for (let i = 1; i <= tenureMonths; i++) {
      const isLast = i === tenureMonths;
      const amount = isLast
        ? summary.totalPayable - summary.monthlyEmi * (tenureMonths - 1)
        : summary.monthlyEmi;
      rows.push({
        emiNo: i,
        dueDate: addMonthsUtc(start, i, emiDay).toISOString(),
        amount,
        principal: round(principal / tenureMonths),
        interest: amount - round(principal / tenureMonths),
      });
    }
    return rows;
  }

  const monthlyRate = interestRate / 100 / 12;
  let remaining = principal;
  for (let i = 1; i <= tenureMonths; i++) {
    const interest = round(remaining * monthlyRate);
    const isLast = i === tenureMonths;
    const principalPart = isLast ? remaining : round(summary.monthlyEmi - interest);
    const amount =
      isLast && remaining - principalPart !== 0
        ? principalPart + interest
        : summary.monthlyEmi;
    remaining = Math.max(0, remaining - principalPart);
    rows.push({
      emiNo: i,
      dueDate: addMonthsUtc(start, i, emiDay).toISOString(),
      amount,
      principal: principalPart,
      interest,
    });
  }
  return rows;
}

export function computeDaysLate(dueDate: string, today: Date): number {
  const due = new Date(dueDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const startToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.max(0, Math.floor((startToday - startDue) / msPerDay));
}