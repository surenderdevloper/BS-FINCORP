export type FieldErrors = Record<string, string>;

export const isValidMobile = (m: string) => /^[6-9]\d{9}$/.test(m);
export const isValidAadhaar = (a: string) => /^\d{12}$/.test(a);
export const isValidPan = (p: string) => /^[A-Z]{5}\d{4}[A-Z]$/i.test(p);

export function validateCustomerShape(input: {
  name: string;
  mobile: string;
  aadhaar?: string;
  pan?: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name?.trim()) errors.name = "Customer name is required.";
  if (!isValidMobile(input.mobile ?? "")) errors.mobile = "Enter a valid 10-digit Indian mobile number.";
  if (input.aadhaar && input.aadhaar.length > 0 && !isValidAadhaar(input.aadhaar))
    errors.aadhaar = "Aadhaar must be a 12-digit number.";
  if (input.pan && input.pan.length > 0 && !isValidPan(input.pan))
    errors.pan = "PAN must be in format ABCDE1234F.";
  return errors;
}

export function validateFinancialShape(input: {
  vehiclePrice: number;
  downPayment: number;
  interestRate: number;
  tenureMonths: number;
  emiDay: number;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!Number.isFinite(input.vehiclePrice) || input.vehiclePrice <= 0)
    errors.vehiclePrice = "Vehicle price must be greater than 0.";
  if (!Number.isFinite(input.downPayment) || input.downPayment < 0)
    errors.downPayment = "Down payment cannot be negative.";
  if ((input.vehiclePrice - input.downPayment) <= 0)
    errors.downPayment = "Down payment must be less than the vehicle price.";
  if (!Number.isFinite(input.interestRate) || input.interestRate <= 0 || input.interestRate > 100)
    errors.interestRate = "Interest rate must be between 0 and 100.";
  if (!Number.isFinite(input.tenureMonths) || input.tenureMonths < 1 || input.tenureMonths > 60)
    errors.tenureMonths = "Tenure must be between 1 and 60 months.";
  if (!Number.isFinite(input.emiDay) || input.emiDay < 1 || input.emiDay > 31)
    errors.emiDay = "EMI date must be between 1 and 31.";
  return errors;
}