export type EmployeeSourceType = 'sale' | 'custom';
export type PayrollPaymentStatus = 'unpaid' | 'paid';

export interface EmployeePayroll {
  id: string;
  monthYear: string;
  employeeType: EmployeeSourceType;
  saleUserId: string;
  employeeName: string;
  employeeEmail: string;
  phone: string;
  position: string;
  workDays: number;
  baseSalary: number;
  allowance: number;
  commissionAmount: number;
  bonus: number;
  deduction: number;
  netSalary: number;
  paymentStatus: PayrollPaymentStatus;
  paymentDate: string;
  notes: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface EmployeePayrollInput {
  monthYear: string;
  employeeType: EmployeeSourceType;
  saleUserId: string;
  employeeName: string;
  employeeEmail: string;
  phone: string;
  position: string;
  workDays: number;
  baseSalary: number;
  allowance: number;
  commissionAmount: number;
  bonus: number;
  deduction: number;
  paymentStatus: PayrollPaymentStatus;
  paymentDate: string;
  notes: string;
}
