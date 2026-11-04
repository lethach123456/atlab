import type { DentalOrder } from '../types/dental';
import type { EmployeePayroll, EmployeeSourceType } from '../types/payroll';
import type { SaleCommission } from '../types/commission';
import type { UserProfile } from '../types/user';
import { normalizeClinicName } from './debtLedger';

export function getEmployeeKey(record: {
  employeeType: EmployeeSourceType;
  saleUserId?: string;
  employeeName: string;
}): string {
  if (record.employeeType === 'sale' && record.saleUserId?.trim()) {
    return `sale:${record.saleUserId.trim()}`;
  }
  return `custom:${record.employeeName
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')}`;
}

interface EmployeeRosterEntry {
  key: string;
  employeeType: EmployeeSourceType;
  saleUserId: string;
  employeeName: string;
  employeeEmail: string;
  phone: string;
  position: string;
  baseSalary: number;
  updatedAt: number;
}

export function buildEmployeeRoster(records: EmployeePayroll[]): EmployeeRosterEntry[] {
  const map = new Map<string, EmployeeRosterEntry>();

  for (const r of records) {
    const key = getEmployeeKey(r);
    const existing = map.get(key);
    const rUpdated = r.updatedAt || 0;
    if (!existing || rUpdated >= existing.updatedAt) {
      map.set(key, {
        key,
        employeeType: r.employeeType,
        saleUserId: r.saleUserId,
        employeeName: r.employeeName,
        employeeEmail: r.employeeEmail || existing?.employeeEmail || '',
        phone: r.phone || existing?.phone || '',
        position: r.position || existing?.position || 'Nhân viên',
        baseSalary: r.baseSalary,
        updatedAt: rUpdated,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, 'vi')
  );
}

export function calculateSaleCommissionInfo(
  orders: DentalOrder[],
  commissions: SaleCommission[],
  saleUid: string,
  monthYear: string
) {
  const revenueByClinic = new Map<string, number>();
  for (const order of orders) {
    if (!order.clinicName || (monthYear !== 'ALL' && order.monthYear !== monthYear)) continue;
    const key = normalizeClinicName(order.clinicName);
    revenueByClinic.set(key, (revenueByClinic.get(key) ?? 0) + (order.totalAmount || 0));
  }

  const assigned = commissions.filter((record) => record.saleId === saleUid);
  const details = assigned.flatMap(({ clinicName, ratePercent }) => {
    const revenue = revenueByClinic.get(normalizeClinicName(clinicName)) ?? 0;
    if (revenue <= 0) return [];
    return [{ clinicName, ratePercent, revenue, commission: Math.round(revenue * ratePercent / 100) }];
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    totalCommission: details.reduce((sum, row) => sum + row.commission, 0),
    totalRevenue: details.reduce((sum, row) => sum + row.revenue, 0),
    clinicCount: details.length,
    assignedCount: assigned.length,
    details,
  };
}

export function buildPayrollRows(
  records: EmployeePayroll[],
  employeeRoster: EmployeeRosterEntry[],
  selectedMonth: string,
  saleCommissions: ReadonlyMap<string, number>,
  getCommissionForPeriod: (saleUid: string, monthYear: string) => number
): EmployeePayroll[] {
  if (selectedMonth === 'ALL') {
    return records.map((r) => {
      const key = getEmployeeKey(r);
      const master = employeeRoster.find((m) => m.key === key);
      const fixedBase = master ? master.baseSalary : r.baseSalary;
      const effectiveComm =
        r.employeeType === 'sale' && r.saleUserId
          ? getCommissionForPeriod(r.saleUserId, r.monthYear)
          : r.commissionAmount;
      const netSalary = Math.max(
        0,
        fixedBase + r.allowance + effectiveComm + r.bonus - r.deduction
      );
      return {
        ...r,
        baseSalary: fixedBase,
        commissionAmount: effectiveComm,
        netSalary,
      };
    });
  }

  const savedInMonth = new Map<string, EmployeePayroll>();
  for (const r of records) {
    if (r.monthYear === selectedMonth) {
      savedInMonth.set(getEmployeeKey(r), r);
    }
  }

  return employeeRoster.map((emp) => {
    const saved = savedInMonth.get(emp.key);
    const autoSaleComm =
      emp.employeeType === 'sale' && emp.saleUserId
        ? saleCommissions.get(emp.saleUserId) ?? 0
        : 0;

    if (saved) {
      const fixedBase = emp.baseSalary;
      const effectiveComm =
        emp.employeeType === 'sale' && emp.saleUserId
          ? autoSaleComm
          : saved.commissionAmount;
      const netSalary = Math.max(
        0,
        fixedBase +
          saved.allowance +
          effectiveComm +
          saved.bonus -
          saved.deduction
      );
      return {
        ...saved,
        employeeName: emp.employeeName,
        employeeEmail: emp.employeeEmail,
        phone: emp.phone,
        position: emp.position,
        baseSalary: fixedBase,
        commissionAmount: effectiveComm,
        netSalary,
      };
    }

    // Carry the current base salary into a period with no saved monthly adjustments.
    const netSalary = Math.max(0, emp.baseSalary + autoSaleComm);

    return {
      id: `virtual__${emp.key}__${selectedMonth}`,
      monthYear: selectedMonth,
      employeeType: emp.employeeType,
      saleUserId: emp.saleUserId,
      employeeName: emp.employeeName,
      employeeEmail: emp.employeeEmail,
      phone: emp.phone,
      position: emp.position,
      workDays: 26,
      baseSalary: emp.baseSalary,
      allowance: 0,
      commissionAmount: autoSaleComm,
      bonus: 0,
      deduction: 0,
      netSalary,
      paymentStatus: 'unpaid',
      paymentDate: `05/${selectedMonth}`,
      notes: '',
    };
  });
}

/** The same monthly payroll shown in Bảng lương, including projected rows for existing employees. */
export function buildMonthlyPayroll(
  records: EmployeePayroll[],
  orders: DentalOrder[],
  commissions: SaleCommission[],
  month: string,
  users?: Pick<UserProfile, 'uid' | 'role'>[]
): EmployeePayroll[] {
  const roster = buildEmployeeRoster(records);
  const eligibleSales = users && new Set(users.filter((user) => user.role === 'sale').map((user) => user.uid));
  const commissionFor = (saleUid: string, period: string) =>
    calculateSaleCommissionInfo(orders, commissions, saleUid, period).totalCommission;

  const monthlyCommissions = new Map<string, number>();
  if (month !== 'ALL') {
    for (const employee of roster) {
      const uid = employee.saleUserId;
      if (employee.employeeType === 'sale' && uid && (!eligibleSales || eligibleSales.has(uid))) {
        monthlyCommissions.set(uid, commissionFor(uid, month));
      }
    }
  }
  return buildPayrollRows(records, roster, month, monthlyCommissions, commissionFor);
}
