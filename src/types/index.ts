export interface CustomerFormData {
  name: string;
  fatherName: string;
  mobile: string;
  altMobile: string;
  aadhaar: string;
  pan: string;
  dob: string;
  address: string;
  city: string;
  state: string;
}

export interface VehicleFormData {
  name: string;
  model: string;
  engineNo: string;
  chassisNo: string;
  regNo: string;
  loanType: string;
  dealerName: string;
}

export interface FinancialFormData {
  vehiclePrice: number;
  downPayment: number;
  interestRate: number;
  interestType: "flat" | "reducing";
  tenureMonths: number;
  emiDay: number;
  startDate: string;
}

export interface GuarantorFormData {
  name: string;
  mobile: string;
  relation: string;
  address: string;
}

export interface LoanFormPayload {
  customerId?: string;
  customer?: CustomerFormData;
  vehicle: VehicleFormData;
  financial: FinancialFormData;
  guarantor: GuarantorFormData;
}

export interface OverdueRow {
  emiId: string;
  customerId: string;
  customerName: string;
  mobile: string;
  loanNo: string;
  vehicle: string;
  dueDate: string;
  amount: number;
  daysLate: number;
  penalty: number;
}

export interface ReminderRow {
  emiId: string;
  emiNo: number;
  customerId: string;
  customerName: string;
  mobile: string;
  loanNo: string;
  vehicle: string;
  dueDate: string;
  amount: number;
  daysLeft: number;
}

export interface TodayCollectionRow {
  paymentId: string;
  receiptNo: string;
  customerName: string;
  loanNo: string;
  amount: number;
  penalty: number;
  mode: string;
  paidAt: string;
}

export interface DashboardData {
  totalCustomers: number;
  activeLoans: number;
  closedLoans: number;
  pendingEmis: number;
  overdueEmis: number;
  todayCollection: number;
  totalDisbursed: number;
  pendingAmount: number;
  totalCollection: number;
  upcomingEmis: number;
  overdueRows: OverdueRow[];
  todayRows: TodayCollectionRow[];
  reminders: ReminderRow[];
}