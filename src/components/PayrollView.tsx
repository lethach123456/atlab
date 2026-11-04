import React, { useState, useMemo } from 'react';
import type { DentalOrder } from '../types/dental';
import type { UserProfile } from '../types/user';
import type { SaleCommission } from '../types/commission';
import type {
  EmployeePayroll,
  EmployeePayrollInput,
  EmployeeSourceType,
  PayrollPaymentStatus,
} from '../types/payroll';
import {
  formatVND,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import {
  Calendar,
  Plus,
  UserPlus,
  Users,
  Search,
  DollarSign,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  X,
  Sparkles,
  Copy,
  Award,
  Wallet,
  Table2,
  FileSpreadsheet,
  Columns2,
  Maximize2,
} from 'lucide-react';

interface PayrollViewProps {
  records: EmployeePayroll[];
  users: UserProfile[];
  commissions: SaleCommission[];
  orders: DentalOrder[];
  availableMonths: string[];
  loading: boolean;
  loadError: string;
  onSave: (input: EmployeePayrollInput, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const POSITION_SUGGESTIONS = [
  'Sale / Kinh doanh',
  'Kỹ thuật viên CAD/CAM',
  'Kỹ thuật viên Đắp sứ',
  'Kỹ thuật viên Mài sườn / Hoàn thiện',
  'Quản lý Labo',
  'Kế toán / Hành chính',
  'Giao nhận (Shipper nội bộ)',
];

const normalizeClinic = (name: string) =>
  name
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/^nha\s+khoa\s+/i, '')
    .replace(/thuỷ/g, 'thủy')
    .replace(/hoà/g, 'hòa')
    .replace(/quý/g, 'quí')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');

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

export function isVirtualRecordId(id: string): boolean {
  return id.startsWith('virtual__');
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  records,
  users,
  commissions,
  orders,
  availableMonths,
  loading,
  loadError,
  onSave,
  onDelete,
}) => {
  const allMonths = useMemo(() => {
    const set = new Set<string>([
      '12/2026',
      '11/2026',
      '10/2026',
      '09/2026',
      ...availableMonths,
    ]);
    records.forEach((r) => {
      if (r.monthYear) set.add(r.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [availableMonths, records]);

  const latestMonth =
    allMonths.find((m) => m === '11/2026') || allMonths[0] || '11/2026';
  const prevMonthOfLatest = getPreviousMonthYear(latestMonth);

  const [selectedMonth, setSelectedMonth] = useState<string>(latestMonth);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'sale' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // View mode: 'summary' (Bảng tổng hợp) or 'individual' (Bảng riêng từng người)
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string>('ALL');
  const [individualColumns, setIndividualColumns] = useState<1 | 2>(2);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<EmployeePayroll | null>(null);
  const [employeeType, setEmployeeType] = useState<EmployeeSourceType>('sale');
  const [saleUserId, setSaleUserId] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [employeeEmail, setEmployeeEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [position, setPosition] = useState<string>('Sale / Kinh doanh');
  const [workDays, setWorkDays] = useState<number>(26);
  const [baseSalary, setBaseSalary] = useState<number>(7000000);
  const [allowance, setAllowance] = useState<number>(0);
  const [commissionAmount, setCommissionAmount] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PayrollPaymentStatus>('unpaid');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // All sale users
  const saleUsers = useMemo(
    () => users.filter((u) => u.role === 'sale'),
    [users]
  );

  // Master Employee Roster: Once an employee is added in any period, their fixed info
  // (employeeName, position, phone, employeeType, saleUserId, and fixed baseSalary)
  // is preserved across all months (10/2026, 11/2026, 12/2026, etc.).
  const employeeRoster = useMemo(() => {
    const map = new Map<
      string,
      {
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
    >();

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
  }, [records]);

  // Calculate automatic commission for a saleUserId in a given monthYear
  // Only include clinics that actually have revenue > 0 ("những nha khoa có số")
  const getSaleCommissionInfo = React.useCallback(
    (saleUid: string, targetMonthYear: string) => {
      const monthOrders =
        targetMonthYear === 'ALL'
          ? orders
          : orders.filter((o) => o.monthYear === targetMonthYear);

      const assigned = commissions.filter((c) => c.saleId === saleUid);
      const details: {
        clinicName: string;
        ratePercent: number;
        revenue: number;
        commission: number;
      }[] = [];

      let totalCommission = 0;
      let totalRevenue = 0;

      for (const cfg of assigned) {
        const key = normalizeClinic(cfg.clinicName);
        const clinicRev = monthOrders
          .filter((o) => o.clinicName && normalizeClinic(o.clinicName) === key)
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        // Only keep clinics that have revenue > 0 in this period
        if (clinicRev <= 0) continue;

        const comm = Math.round((clinicRev * cfg.ratePercent) / 100);
        totalRevenue += clinicRev;
        totalCommission += comm;
        details.push({
          clinicName: cfg.clinicName,
          ratePercent: cfg.ratePercent,
          revenue: clinicRev,
          commission: comm,
        });
      }

      details.sort((a, b) => b.revenue - a.revenue);

      return {
        totalCommission,
        totalRevenue,
        clinicCount: details.length,
        assignedCount: assigned.length,
        details,
      };
    },
    [commissions, orders]
  );

  // Precomputed map for selectedMonth
  const saleCommissionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalCommission: number;
        totalRevenue: number;
        clinicCount: number;
        assignedCount: number;
        details: {
          clinicName: string;
          ratePercent: number;
          revenue: number;
          commission: number;
        }[];
      }
    >();

    for (const sale of saleUsers) {
      map.set(sale.uid, getSaleCommissionInfo(sale.uid, selectedMonth));
    }

    return map;
  }, [saleUsers, getSaleCommissionInfo, selectedMonth]);

  // Build records for the selected month:
  // Every employee in employeeRoster appears in every month with their fixed baseSalary,
  // while allowance, commissionAmount, bonus, deduction, workDays, paymentStatus, notes
  // are specific to that month!
  const monthRecords = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return records.map((r) => {
        const key = getEmployeeKey(r);
        const master = employeeRoster.find((m) => m.key === key);
        const fixedBase = master ? master.baseSalary : r.baseSalary;
        const effectiveComm =
          r.employeeType === 'sale' && r.saleUserId
            ? getSaleCommissionInfo(r.saleUserId, r.monthYear).totalCommission
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
          ? saleCommissionMap.get(emp.saleUserId)?.totalCommission ?? 0
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

      // Employee exists in roster from another period, but hasn't had custom monthly fields saved in selectedMonth yet:
      // Keep fixed baseSalary, and default monthly variables for this period (auto-calculating Sale commission for selectedMonth).
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
        paymentStatus: 'unpaid' as PayrollPaymentStatus,
        paymentDate: `05/${selectedMonth}`,
        notes: '',
      };
    });
  }, [records, selectedMonth, employeeRoster, saleCommissionMap, getSaleCommissionInfo]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return monthRecords.filter((r) => {
      if (sourceFilter !== 'all' && r.employeeType !== sourceFilter) return false;
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false;
      if (q) {
        const matchName = r.employeeName.toLowerCase().includes(q);
        const matchPos = r.position.toLowerCase().includes(q);
        const matchEmail = r.employeeEmail.toLowerCase().includes(q);
        const matchPhone = r.phone.toLowerCase().includes(q);
        const matchNote = r.notes.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchEmail && !matchPhone && !matchNote) {
          return false;
        }
      }
      return true;
    });
  }, [monthRecords, sourceFilter, statusFilter, searchQuery]);

  const displayedIndividualRecords = useMemo(() => {
    if (focusedEmployeeId === 'ALL') return filteredRecords;
    const found = filteredRecords.filter(
      (r) => r.id === focusedEmployeeId || getEmployeeKey(r) === focusedEmployeeId
    );
    return found.length > 0 ? found : filteredRecords;
  }, [filteredRecords, focusedEmployeeId]);

  const summary = useMemo(() => {
    const totalBaseAndAllowance = filteredRecords.reduce(
      (s, r) => s + r.baseSalary + r.allowance,
      0
    );
    const totalCommissionAndBonus = filteredRecords.reduce(
      (s, r) => s + r.commissionAmount + r.bonus,
      0
    );
    const totalDeduction = filteredRecords.reduce((s, r) => s + r.deduction, 0);
    const totalNet = filteredRecords.reduce((s, r) => s + r.netSalary, 0);
    const paidCount = filteredRecords.filter((r) => r.paymentStatus === 'paid').length;
    const unpaidAmount = filteredRecords
      .filter((r) => r.paymentStatus !== 'paid')
      .reduce((s, r) => s + r.netSalary, 0);
    return {
      totalBaseAndAllowance,
      totalCommissionAndBonus,
      totalDeduction,
      totalNet,
      paidCount,
      unpaidAmount,
    };
  }, [filteredRecords]);

  const existingSaleIdsInRoster = useMemo(() => {
    return new Set(
      employeeRoster
        .filter((r) => r.employeeType === 'sale' && r.saleUserId)
        .map((r) => r.saleUserId)
    );
  }, [employeeRoster]);

  const unaddedSalesInMonth = useMemo(() => {
    return saleUsers.filter((s) => !existingSaleIdsInRoster.has(s.uid));
  }, [saleUsers, existingSaleIdsInRoster]);

  const applySaleUserSelection = (uid: string) => {
    setSaleUserId(uid);
    const found = saleUsers.find((s) => s.uid === uid);
    if (found) {
      setEmployeeName(found.displayName || found.email.split('@')[0]);
      setEmployeeEmail(found.email);
      setPosition('Sale / Kinh doanh');
      const existingMaster = employeeRoster.find(
        (m) => m.employeeType === 'sale' && m.saleUserId === uid
      );
      if (existingMaster) {
        setBaseSalary(existingMaster.baseSalary);
        setPhone(existingMaster.phone);
      }
      const autoComm = saleCommissionMap.get(uid)?.totalCommission ?? 0;
      setCommissionAmount(autoComm);
    }
  };

  const openCreateModal = (mode: EmployeeSourceType) => {
    const targetMonth = selectedMonth === 'ALL' ? latestMonth : selectedMonth;
    setEditingRecord(null);
    setEmployeeType(mode);
    setError('');
    setNotice('');
    setWorkDays(26);
    setBaseSalary(mode === 'sale' ? 6000000 : 8000000);
    setAllowance(0);
    setBonus(0);
    setDeduction(0);
    setPaymentStatus('unpaid');
    setPaymentDate(`05/${targetMonth}`);
    setNotes('');
    setPhone('');

    if (mode === 'sale') {
      const defaultSale = unaddedSalesInMonth[0] || saleUsers[0];
      if (defaultSale) {
        setSaleUserId(defaultSale.uid);
        setEmployeeName(defaultSale.displayName || defaultSale.email.split('@')[0]);
        setEmployeeEmail(defaultSale.email);
        setPosition('Sale / Kinh doanh');
        const existingMaster = employeeRoster.find(
          (m) => m.employeeType === 'sale' && m.saleUserId === defaultSale.uid
        );
        if (existingMaster) {
          setBaseSalary(existingMaster.baseSalary);
        }
        setCommissionAmount(
          saleCommissionMap.get(defaultSale.uid)?.totalCommission ?? 0
        );
      } else {
        setSaleUserId('');
        setEmployeeName('');
        setEmployeeEmail('');
        setPosition('Sale / Kinh doanh');
        setCommissionAmount(0);
      }
    } else {
      setSaleUserId('');
      setEmployeeName('');
      setEmployeeEmail('');
      setPosition('Kỹ thuật viên CAD/CAM');
      setCommissionAmount(0);
    }

    setModalOpen(true);
  };

  const openEditModal = (record: EmployeePayroll) => {
    setEditingRecord(record);
    setEmployeeType(record.employeeType);
    setSaleUserId(record.saleUserId);
    setEmployeeName(record.employeeName);
    setEmployeeEmail(record.employeeEmail);
    setPhone(record.phone);
    setPosition(record.position);
    setWorkDays(record.workDays);
    setBaseSalary(record.baseSalary);
    setAllowance(record.allowance);
    setCommissionAmount(record.commissionAmount);
    setBonus(record.bonus);
    setDeduction(record.deduction);
    setPaymentStatus(record.paymentStatus);
    setPaymentDate(record.paymentDate || `05/${record.monthYear}`);
    setNotes(record.notes);
    setError('');
    setNotice('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim()) {
      setError('Vui lòng nhập họ tên nhân viên.');
      return;
    }
    if (employeeType === 'sale' && !saleUserId && saleUsers.length > 0) {
      setError('Vui lòng chọn tài khoản Sale hoặc chuyển sang Tự thêm nhân viên.');
      return;
    }

    const targetMonth = editingRecord
      ? editingRecord.monthYear
      : selectedMonth === 'ALL'
      ? latestMonth
      : selectedMonth;

    const newBaseSalary = Math.max(0, Math.round(Number(baseSalary) || 0));
    const trimmedName = employeeName.trim();
    const trimmedEmail = employeeEmail.trim();
    const trimmedPhone = phone.trim();
    const trimmedPos = position.trim() || 'Nhân viên';

    setBusy(true);
    setError('');
    try {
      const existingDocId =
        editingRecord && !isVirtualRecordId(editingRecord.id)
          ? editingRecord.id
          : undefined;

      const effectiveCommForSave =
        employeeType === 'sale' && saleUserId
          ? getSaleCommissionInfo(saleUserId, targetMonth).totalCommission
          : Number(commissionAmount) || 0;

      // 1. Save this month's payroll record (including monthly variable items + fixed baseSalary)
      await onSave(
        {
          monthYear: targetMonth,
          employeeType,
          saleUserId: employeeType === 'sale' ? saleUserId : '',
          employeeName: trimmedName,
          employeeEmail: trimmedEmail,
          phone: trimmedPhone,
          position: trimmedPos,
          workDays: Number(workDays) || 0,
          baseSalary: newBaseSalary,
          allowance: Number(allowance) || 0,
          commissionAmount: effectiveCommForSave,
          bonus: Number(bonus) || 0,
          deduction: Number(deduction) || 0,
          paymentStatus,
          paymentDate: paymentDate.trim(),
          notes: notes.trim(),
        },
        existingDocId
      );

      // 2. Sync fixed baseSalary & profile info across all other existing monthly records of this employee
      // so baseSalary stays identical across 10/2026, 11/2026, 12/2026, etc. while keeping each month's own allowance/commission/bonus/deduction!
      const targetKey = getEmployeeKey({
        employeeType,
        saleUserId: employeeType === 'sale' ? saleUserId : '',
        employeeName: trimmedName,
      });
      const prevKey = editingRecord ? getEmployeeKey(editingRecord) : targetKey;

      const otherMonthDocs = records.filter((r) => {
        if (existingDocId && r.id === existingDocId) return false;
        if (r.monthYear === targetMonth && getEmployeeKey(r) === targetKey) return false;
        const k = getEmployeeKey(r);
        return k === targetKey || k === prevKey;
      });

      for (const other of otherMonthDocs) {
        if (
          other.baseSalary !== newBaseSalary ||
          other.employeeName !== trimmedName ||
          other.position !== trimmedPos ||
          other.phone !== trimmedPhone
        ) {
          await onSave(
            {
              monthYear: other.monthYear,
              employeeType,
              saleUserId: employeeType === 'sale' ? saleUserId : '',
              employeeName: trimmedName,
              employeeEmail: trimmedEmail,
              phone: trimmedPhone,
              position: trimmedPos,
              workDays: other.workDays,
              baseSalary: newBaseSalary,
              allowance: other.allowance,
              commissionAmount: other.commissionAmount,
              bonus: other.bonus,
              deduction: other.deduction,
              paymentStatus: other.paymentStatus,
              paymentDate: other.paymentDate,
              notes: other.notes,
            },
            other.id
          );
        }
      }

      setNotice(
        editingRecord
          ? `Đã lưu bảng lương kỳ ${targetMonth} của ${trimmedName} (Lương cơ bản cố định các kỳ: ${formatVND(newBaseSalary)}).`
          : `Đã thêm ${trimmedName} vào danh sách lương (Lương cơ bản cố định các kỳ: ${formatVND(newBaseSalary)}).`
      );
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được bảng lương.');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkAddAllSales = async () => {
    if (unaddedSalesInMonth.length === 0) return;
    const targetMonth = selectedMonth === 'ALL' ? latestMonth : selectedMonth;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      for (const sale of unaddedSalesInMonth) {
        const autoComm = saleCommissionMap.get(sale.uid)?.totalCommission ?? 0;
        await onSave({
          monthYear: targetMonth,
          employeeType: 'sale',
          saleUserId: sale.uid,
          employeeName: sale.displayName || sale.email.split('@')[0],
          employeeEmail: sale.email,
          phone: '',
          position: 'Sale / Kinh doanh',
          workDays: 26,
          baseSalary: 6000000,
          allowance: 0,
          commissionAmount: autoComm,
          bonus: 0,
          deduction: 0,
          paymentStatus: 'unpaid',
          paymentDate: `05/${targetMonth}`,
          notes: '',
        });
      }
      setNotice(
        `Đã thêm ${unaddedSalesInMonth.length} nhân sự Sale vào danh sách lương.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa thêm được danh sách Sale.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEmployee = async (row: EmployeePayroll) => {
    setBusy(true);
    setError('');
    try {
      const empKey = getEmployeeKey(row);
      const matchingDocs = records.filter((r) => getEmployeeKey(r) === empKey);
      for (const docItem of matchingDocs) {
        await onDelete(docItem.id);
      }
      setConfirmDeleteId(null);
      setNotice(`Đã xóa nhân sự ${row.employeeName} khỏi bảng lương.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được nhân sự.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePaid = async (record: EmployeePayroll) => {
    setBusy(true);
    setError('');
    try {
      const nextStatus: PayrollPaymentStatus =
        record.paymentStatus === 'paid' ? 'unpaid' : 'paid';
      const existingDocId = isVirtualRecordId(record.id) ? undefined : record.id;
      await onSave(
        {
          monthYear: record.monthYear,
          employeeType: record.employeeType,
          saleUserId: record.saleUserId,
          employeeName: record.employeeName,
          employeeEmail: record.employeeEmail,
          phone: record.phone,
          position: record.position,
          workDays: record.workDays,
          baseSalary: record.baseSalary,
          allowance: record.allowance,
          commissionAmount: record.commissionAmount,
          bonus: record.bonus,
          deduction: record.deduction,
          paymentStatus: nextStatus,
          paymentDate: record.paymentDate || `05/${record.monthYear}`,
          notes: record.notes,
        },
        existingDocId
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được trạng thái.');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncSaleCommission = async (
    record: EmployeePayroll,
    newComm: number
  ) => {
    setBusy(true);
    setError('');
    try {
      const existingDocId = isVirtualRecordId(record.id) ? undefined : record.id;
      await onSave(
        {
          monthYear: record.monthYear,
          employeeType: record.employeeType,
          saleUserId: record.saleUserId,
          employeeName: record.employeeName,
          employeeEmail: record.employeeEmail,
          phone: record.phone,
          position: record.position,
          workDays: record.workDays,
          baseSalary: record.baseSalary,
          allowance: record.allowance,
          commissionAmount: newComm,
          bonus: record.bonus,
          deduction: record.deduction,
          paymentStatus: record.paymentStatus,
          paymentDate: record.paymentDate || `05/${record.monthYear}`,
          notes: record.notes,
        },
        existingDocId
      );
      setNotice(`Đã cập nhật hoa hồng kỳ ${record.monthYear} cho ${record.employeeName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được hoa hồng.');
    } finally {
      setBusy(false);
    }
  };

  const modalTargetMonth = editingRecord
    ? editingRecord.monthYear
    : selectedMonth === 'ALL'
    ? latestMonth
    : selectedMonth;

  const effectiveModalCommission =
    employeeType === 'sale'
      ? saleUserId
        ? getSaleCommissionInfo(saleUserId, modalTargetMonth).totalCommission
        : 0
      : Number(commissionAmount) || 0;

  const previewNetSalary = Math.max(
    0,
    (Number(baseSalary) || 0) +
      (Number(allowance) || 0) +
      effectiveModalCommission +
      (Number(bonus) || 0) -
      (Number(deduction) || 0)
  );

  return (
    <div className="space-y-4">
      {/* Top Command & Filter Bar */}
      <div className="bento-card p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setFocusedEmployeeId('ALL');
              }}
              className="pl-8 pr-4 py-1.5 text-xs font-mono font-bold bg-white/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white cursor-pointer"
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  Kỳ Lương {m}
                  {m === latestMonth
                    ? ' (Tháng này)'
                    : m === prevMonthOfLatest
                    ? ' (Tháng trước)'
                    : ''}
                </option>
              ))}
              <option value="ALL">Tất cả các kỳ</option>
            </select>
          </div>

          {/* Layout / View Mode Switcher: Bảng tổng hợp vs Bảng từng người */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-950/90 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                viewMode === 'summary'
                  ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Bảng tổng hợp</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('individual')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                viewMode === 'individual'
                  ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bảng từng người</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/80 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                sourceFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tất cả ({monthRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('sale')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                sourceFilter === 'sale'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Từ Sale ({monthRecords.filter((r) => r.employeeType === 'sale').length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('custom')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                sourceFilter === 'custom'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tự thêm ({monthRecords.filter((r) => r.employeeType === 'custom').length})
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/80 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500'
              }`}
            >
              Mọi TT
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'bg-amber-500 text-white shadow-2xs font-bold'
                  : 'text-slate-500'
              }`}
            >
              Chưa trả
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-500'
              }`}
            >
              Đã trả
            </button>
          </div>

          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên nhân viên, chức vụ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Add Employee Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {unaddedSalesInMonth.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleBulkAddAllSales}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/25 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Thêm nhanh {unaddedSalesInMonth.length} Sale</span>
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => openCreateModal('sale')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Users className="w-3.5 h-3.5" />
            <span>+ Thêm từ Sale</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => openCreateModal('custom')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Tự thêm NV</span>
          </button>
        </div>
      </div>

      {(error || loadError) && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {error || loadError}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      {/* 4 Deep Dark-Jewel KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Quỹ Lương Thực Lĩnh
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {formatVND(summary.totalNet)}
            </div>
            <span className="text-[11px] text-sky-300/90 font-mono mt-1 block">
              {filteredRecords.length} nhân sự · Kỳ {selectedMonth}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0 relative">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Lương Cơ Bản & Phụ Cấp
            </span>
            <div className="font-display text-2xl font-bold font-mono text-teal-300 mt-1">
              {formatVND(summary.totalBaseAndAllowance)}
            </div>
            <span className="text-[11px] text-slate-300/80 font-mono mt-1 block">
              Khấu trừ kỳ này: -{formatVND(summary.totalDeduction)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0 relative">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Hoa Hồng / Sản Lượng & Thưởng
            </span>
            <div className="font-display text-2xl font-bold font-mono text-amber-300 mt-1">
              {formatVND(summary.totalCommissionAndBonus)}
            </div>
            <span className="text-[11px] text-slate-300/80 font-mono mt-1 block">
              Tuỳ chỉnh theo kỳ {selectedMonth}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0 relative">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tiến Độ Chi Trả Lương
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {summary.paidCount} / {filteredRecords.length}{' '}
              <span className="text-xs font-bold text-violet-300 uppercase">NV</span>
            </div>
            <span className="text-[11px] text-violet-300/90 font-mono mt-1 block">
              Còn nợ lương: {formatVND(summary.unpaidAmount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300 flex items-center justify-center shrink-0 relative">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Mode 1: Consolidated Payroll Table (Bảng tổng hợp) */}
      {viewMode === 'summary' && (
        <div className="bento-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Bảng Lương Tổng Hợp — Kỳ {selectedMonth === 'ALL' ? 'Toàn bộ' : selectedMonth} ({filteredRecords.length} nhân sự)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lương cơ bản được giữ cố định xuyên suốt các kỳ (10, 11, 12...). Các mục Phụ cấp, Hoa hồng / Sản lượng, Thưởng, Khấu trừ được tuỳ chỉnh riêng theo từng tháng.
              </p>
            </div>
            <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-sky-400">
              Tổng thực lĩnh: {formatVND(summary.totalNet)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3">Nhân Viên</th>
                  <th className="py-2.5 px-3">Bộ Phận / Chức Vụ</th>
                  <th className="py-2.5 px-3 text-right">
                    Lương Cơ Bản
                    <span className="block text-[9px] font-normal text-slate-400 normal-case">
                      Cố định các kỳ
                    </span>
                  </th>
                  <th className="py-2.5 px-2 text-center">
                    Ngày Công
                    <span className="block text-[9px] font-normal text-blue-500 normal-case">
                      Theo tháng
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Phụ Cấp
                    <span className="block text-[9px] font-normal text-blue-500 normal-case">
                      Theo tháng
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Hoa Hồng / Sản Lượng
                    <span className="block text-[9px] font-normal text-blue-500 normal-case">
                      Theo tháng
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Thưởng
                    <span className="block text-[9px] font-normal text-blue-500 normal-case">
                      Theo tháng
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Khấu Trừ
                    <span className="block text-[9px] font-normal text-blue-500 normal-case">
                      Theo tháng
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">Thực Lĩnh</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredRecords.map((row, idx) => {
                  const saleCalc =
                    row.employeeType === 'sale' && row.saleUserId
                      ? getSaleCommissionInfo(row.saleUserId, row.monthYear)
                      : undefined;
                  const hasCommissionDiff =
                    saleCalc !== undefined &&
                    saleCalc.assignedCount > 0 &&
                    saleCalc.totalCommission !== row.commissionAmount;
                  const empKey = getEmployeeKey(row);

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedEmployeeId(empKey);
                              setViewMode('individual');
                            }}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 cursor-pointer text-left"
                            title="Xem bảng lương riêng của nhân viên này"
                          >
                            {row.employeeName}
                          </button>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            · {row.employeeType === 'sale' ? 'Sale' : 'Tự thêm'}
                          </span>
                        </div>
                        {(row.employeeEmail || row.phone) && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {[row.employeeEmail, row.phone].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {row.notes && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            {row.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {row.position}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatVND(row.baseSalary)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {row.workDays}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatVND(row.allowance)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-teal-700 dark:text-teal-400">
                          {formatVND(row.commissionAmount)}
                        </div>
                        {saleCalc && (saleCalc.clinicCount > 0 || hasCommissionDiff) && (
                          <div className="mt-0.5 flex flex-col items-end gap-0.5 font-sans">
                            {saleCalc.clinicCount > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {saleCalc.clinicCount} NK có số · DT: {formatVND(saleCalc.totalRevenue)}
                              </span>
                            )}
                            {hasCommissionDiff && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleSyncSaleCommission(row, saleCalc.totalCommission)
                                }
                                className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                              >
                                Cập nhật theo HĐ: {formatVND(saleCalc.totalCommission)}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {row.bonus > 0 ? `+${formatVND(row.bonus)}` : '0 ₫'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                        {row.deduction > 0 ? `-${formatVND(row.deduction)}` : '0 ₫'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-700 dark:text-sky-400 whitespace-nowrap">
                        {formatVND(row.netSalary)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTogglePaid(row)}
                          title="Nhấn để đổi trạng thái thanh toán"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                            row.paymentStatus === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {row.paymentStatus === 'paid' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Đã trả
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Chưa trả
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedEmployeeId(empKey);
                              setViewMode('individual');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-sky-300 font-semibold text-[11px] cursor-pointer"
                            title="Mở bảng lương chi tiết của nhân viên này"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            Bảng riêng
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[11px] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            Tuỳ chỉnh kỳ
                          </button>
                          {confirmDeleteId === row.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(row)}
                              className="px-2 py-1 rounded-md bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Xóa NV?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                              title="Xóa nhân viên khỏi bảng lương"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-10 px-4 text-center text-slate-500">
                      {loading
                        ? 'Đang tải bảng lương...'
                        : 'Chưa có nhân viên nào trong danh sách lương. Bấm "+ Thêm từ Sale" hoặc "+ Tự thêm NV" để lập bảng lương.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredRecords.length > 0 && (
                <tfoot className="bg-slate-50/90 dark:bg-slate-950/60 font-mono font-bold text-xs border-t border-slate-200 dark:border-slate-800">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 uppercase">
                      Tổng cộng ({filteredRecords.length} nhân sự)
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                      {formatVND(filteredRecords.reduce((s, r) => s + r.baseSalary, 0))}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                      {formatVND(filteredRecords.reduce((s, r) => s + r.allowance, 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-teal-700 dark:text-teal-400">
                      {formatVND(filteredRecords.reduce((s, r) => s + r.commissionAmount, 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                      {formatVND(filteredRecords.reduce((s, r) => s + r.bonus, 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                      {formatVND(filteredRecords.reduce((s, r) => s + r.deduction, 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-700 dark:text-sky-400 font-extrabold">
                      {formatVND(summary.totalNet)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Individual Payroll Table Per Person (Giao diện kiểu bảng cho từng người) */}
      {viewMode === 'individual' && (
        <div className="space-y-4">
          {/* Sub-bar to select a specific employee or view all individual tables + column layout option */}
          <div className="bento-card p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
                Chọn nhân sự:
              </span>
              <button
                type="button"
                onClick={() => setFocusedEmployeeId('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  focusedEmployeeId === 'ALL'
                    ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Tất cả ({filteredRecords.length} bảng)
              </button>
              {filteredRecords.map((emp) => {
                const empKey = getEmployeeKey(emp);
                const isSelected =
                  focusedEmployeeId === emp.id || focusedEmployeeId === empKey;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setFocusedEmployeeId(empKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                    }`}
                  >
                    {emp.employeeName}
                  </button>
                );
              })}
            </div>

            {displayedIndividualRecords.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIndividualColumns(1)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    individualColumns === 1
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-2xs'
                      : 'text-slate-500'
                  }`}
                  title="Hiển thị 1 bảng lớn mỗi hàng"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>1 Cột</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIndividualColumns(2)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    individualColumns === 2
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-2xs'
                      : 'text-slate-500'
                  }`}
                  title="Hiển thị 2 bảng song song mỗi hàng"
                >
                  <Columns2 className="w-3 h-3" />
                  <span>2 Cột</span>
                </button>
              </div>
            )}
          </div>

          {displayedIndividualRecords.length === 0 ? (
            <div className="bento-card rounded-2xl p-10 text-center text-xs text-slate-500">
              {loading
                ? 'Đang tải bảng lương...'
                : 'Chưa có nhân viên nào trong danh sách lương. Bấm "+ Thêm từ Sale" hoặc "+ Tự thêm NV" để lập bảng lương.'}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                displayedIndividualRecords.length > 1 && individualColumns === 2
                  ? 'xl:grid-cols-2'
                  : ''
              } gap-4`}
            >
              {displayedIndividualRecords.map((row, index) => {
                const saleCalc =
                  row.employeeType === 'sale' && row.saleUserId
                    ? getSaleCommissionInfo(row.saleUserId, row.monthYear)
                    : undefined;
                const hasCommissionDiff =
                  saleCalc !== undefined &&
                  saleCalc.assignedCount > 0 &&
                  saleCalc.totalCommission !== row.commissionAmount;
                const grossIncome =
                  row.baseSalary + row.allowance + row.commissionAmount + row.bonus;

                return (
                  <div
                    key={row.id}
                    className="bento-card rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      {/* Employee Table Header Banner */}
                      <div className="px-4 py-3.5 bg-slate-900 dark:bg-slate-950 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-sky-400 font-bold">
                              #{index + 1}
                            </span>
                            <h3 className="font-display font-bold text-sm text-white">
                              BẢNG LƯƠNG: {row.employeeName.toUpperCase()}
                            </h3>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span>{row.position}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {row.employeeType === 'sale'
                                ? 'Nhân sự Sale'
                                : 'Nhân sự Labo'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">Kỳ {row.monthYear}</span>
                            {row.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{row.phone}</span>
                              </>
                            )}
                            {row.employeeEmail && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{row.employeeEmail}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleTogglePaid(row)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              row.paymentStatus === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {row.paymentStatus === 'paid' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đã thanh toán
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                Chờ thanh toán
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            Tuỳ chỉnh kỳ {row.monthYear}
                          </button>

                          {confirmDeleteId === row.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(row)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Xác nhận xóa NV
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg cursor-pointer"
                              title="Xóa nhân viên này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Individual Structured Accounting Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px]">
                            <tr>
                              <th className="py-2 px-3 text-center w-10">STT</th>
                              <th className="py-2 px-3">Khoản Mục Lương</th>
                              <th className="py-2 px-3">Diễn Giải / Chi Tiết Tính</th>
                              <th className="py-2 px-3 text-right">Thành Tiền (VNĐ)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                            {/* Row 1: Lương cơ bản */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                01
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                Lương cơ bản cố định
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                                Giữ cố định các kỳ · Ngày công T.{row.monthYear.split('/')[0]}:{' '}
                                <strong>{row.workDays}</strong> ngày
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatVND(row.baseSalary)}
                              </td>
                            </tr>

                            {/* Row 2: Phụ cấp */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                02
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                Phụ cấp (Kỳ {row.monthYear})
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                Tuỳ chỉnh theo tháng (Ăn ca, xăng xe, điện thoại, trách nhiệm)
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {formatVND(row.allowance)}
                              </td>
                            </tr>

                            {/* Row 3: Hoa hồng / Sản lượng */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                03
                              </td>
                              <td className="py-2.5 px-3 font-bold text-teal-700 dark:text-teal-400">
                                {row.employeeType === 'sale'
                                  ? `Hoa hồng Sale (Kỳ ${row.monthYear})`
                                  : `Sản lượng / Hoa hồng (Kỳ ${row.monthYear})`}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                {saleCalc && saleCalc.details.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                      Tổng DT {saleCalc.clinicCount} nha khoa có số kỳ {row.monthYear}:{' '}
                                      <span className="font-mono">
                                        {formatVND(saleCalc.totalRevenue)}
                                      </span>
                                    </div>
                                    <div className="space-y-0.5">
                                      {saleCalc.details.map((d) => (
                                        <div
                                          key={d.clinicName}
                                          className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2"
                                        >
                                          <span>
                                            • {d.clinicName} ({d.ratePercent}% ×{' '}
                                            {formatVND(d.revenue)})
                                          </span>
                                          <span className="font-semibold text-teal-700 dark:text-teal-400">
                                            {formatVND(d.commission)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {hasCommissionDiff && (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleSyncSaleCommission(
                                            row,
                                            saleCalc.totalCommission
                                          )
                                        }
                                        className="mt-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                                      >
                                        Đồng bộ theo HĐ thực tế:{' '}
                                        {formatVND(saleCalc.totalCommission)}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span>
                                      {row.employeeType === 'sale'
                                        ? `Chưa có nha khoa phát sinh doanh số trong kỳ ${row.monthYear}`
                                        : `Tuỳ chỉnh sản lượng ca răng / hoa hồng phát sinh trong kỳ ${row.monthYear}`}
                                    </span>
                                    {hasCommissionDiff && saleCalc && (
                                      <div>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            handleSyncSaleCommission(
                                              row,
                                              saleCalc.totalCommission
                                            )
                                          }
                                          className="mt-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                                        >
                                          Đồng bộ theo HĐ thực tế:{' '}
                                          {formatVND(saleCalc.totalCommission)}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                                {formatVND(row.commissionAmount)}
                              </td>
                            </tr>

                            {/* Row 4: Thưởng thêm */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                04
                              </td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                                Thưởng thêm / Tăng ca (Kỳ {row.monthYear})
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                Tuỳ chỉnh theo tháng (Thưởng chuyên cần, vượt tiến độ, tăng ca)
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                +{formatVND(row.bonus)}
                              </td>
                            </tr>

                            {/* Row 5: Tổng thu nhập gộp */}
                            <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                              <td className="py-2 px-3 text-center font-mono text-slate-400">
                                —
                              </td>
                              <td
                                colSpan={2}
                                className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300"
                              >
                                Tổng thu nhập gộp (01 + 02 + 03 + 04)
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatVND(grossIncome)}
                              </td>
                            </tr>

                            {/* Row 6: Khấu trừ / Tạm ứng */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                05
                              </td>
                              <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                                Khấu trừ / Tạm ứng (Kỳ {row.monthYear})
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                {row.notes
                                  ? `Ghi chú kỳ ${row.monthYear}: ${row.notes}`
                                  : 'Tuỳ chỉnh tạm ứng lương trong tháng / khấu trừ khác'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                -{formatVND(row.deduction)}
                              </td>
                            </tr>
                          </tbody>
                          <tfoot className="bg-blue-50/70 dark:bg-slate-950 border-t-2 border-blue-500/30">
                            <tr>
                              <td
                                colSpan={3}
                                className="py-3 px-3 font-display font-bold text-xs uppercase text-slate-900 dark:text-white"
                              >
                                Thực Lĩnh Kỳ {row.monthYear} ({row.employeeName})
                                {row.paymentDate && (
                                  <span className="block text-[10px] font-mono font-normal text-slate-500 dark:text-slate-400 normal-case mt-0.5">
                                    Ngày thanh toán dự kiến: {row.paymentDate}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm font-extrabold text-blue-700 dark:text-sky-400 whitespace-nowrap">
                                {formatVND(row.netSalary)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Employee Payroll Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">
                  {editingRecord
                    ? `Tuỳ Chỉnh Bảng Lương Kỳ ${editingRecord.monthYear} — ${editingRecord.employeeName}`
                    : `Thêm Nhân Viên Vào Bảng Lương (Áp dụng cho các kỳ)`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {/* Switch between Sale account vs Custom employee */}
              {!editingRecord && (
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeType('sale');
                      const defaultSale = unaddedSalesInMonth[0] || saleUsers[0];
                      if (defaultSale) {
                        applySaleUserSelection(defaultSale.uid);
                      }
                    }}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      employeeType === 'sale'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Chọn từ tài khoản Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeType('custom');
                      setSaleUserId('');
                      setEmployeeName('');
                      setEmployeeEmail('');
                      setPosition('Kỹ thuật viên CAD/CAM');
                      setCommissionAmount(0);
                    }}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      employeeType === 'custom'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Tự thêm nhân viên mới
                  </button>
                </div>
              )}

              {employeeType === 'sale' && (
                <div className="p-3.5 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2.5">
                  <label className="block font-bold text-teal-800 dark:text-teal-300 uppercase">
                    Tài Khoản Sale *
                  </label>
                  {saleUsers.length > 0 ? (
                    <select
                      value={saleUserId}
                      disabled={Boolean(editingRecord)}
                      onChange={(e) => applySaleUserSelection(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    >
                      <option value="">-- Chọn tài khoản Sale --</option>
                      {saleUsers.map((s) => {
                        const already = existingSaleIdsInRoster.has(s.uid);
                        return (
                          <option key={s.uid} value={s.uid}>
                            {s.displayName} ({s.email})
                            {already && !editingRecord ? ' — Đã có trong danh sách lương' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="text-slate-500">
                      Chưa có tài khoản Sale nào trong mục Người dùng. Bạn có thể chuyển sang tab "Tự thêm nhân viên mới".
                    </p>
                  )}

                  {saleUserId &&
                    (() => {
                      const modalMonth = editingRecord
                        ? editingRecord.monthYear
                        : selectedMonth === 'ALL'
                        ? latestMonth
                        : selectedMonth;
                      const modalSaleCalc = getSaleCommissionInfo(saleUserId, modalMonth);
                      return (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                          <div className="flex items-center justify-between">
                            <span>
                              Nha khoa có số kỳ {modalMonth}:{' '}
                              <strong>{modalSaleCalc.clinicCount} nha khoa</strong> · Doanh thu
                              kỳ:{' '}
                              <strong className="font-mono">
                                {formatVND(modalSaleCalc.totalRevenue)}
                              </strong>
                            </span>
                            <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                              HH tự tính kỳ này: {formatVND(modalSaleCalc.totalCommission)}
                            </span>
                          </div>
                          {modalSaleCalc.details.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {modalSaleCalc.details.map((d) => (
                                <span
                                  key={d.clinicName}
                                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono"
                                >
                                  {d.clinicName} ({d.ratePercent}%): {formatVND(d.commission)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* Section 1: Fixed Info across all periods */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                    1. Thông Tin & Lương Cơ Bản Cố Định (Giữ nguyên qua các kỳ 10, 11, 12...)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Họ và Tên Nhân Viên *
                    </label>
                    <input
                      type="text"
                      required
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Bộ Phận / Chức Vụ *
                    </label>
                    <input
                      type="text"
                      list="payroll-position-list"
                      required
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Chọn hoặc tự nhập chức vụ..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                    <datalist id="payroll-position-list">
                      {POSITION_SUGGESTIONS.map((pos) => (
                        <option key={pos} value={pos} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Số Điện Thoại
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0905..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-blue-700 dark:text-sky-400 uppercase mb-1">
                      Lương Cơ Bản Cố Định (VNĐ) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-blue-500/50 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Variable Monthly Items */}
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                  <span className="font-bold text-blue-800 dark:text-sky-300 uppercase text-[11px]">
                    2. Các Mục Tuỳ Chỉnh Riêng Theo Kỳ{' '}
                    {editingRecord
                      ? editingRecord.monthYear
                      : selectedMonth === 'ALL'
                      ? latestMonth
                      : selectedMonth}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Ngày Công Kỳ Này
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      step={0.5}
                      value={workDays}
                      onChange={(e) => setWorkDays(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Phụ Cấp Tháng Này
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={allowance}
                      onChange={(e) => setAllowance(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-teal-700 dark:text-teal-300 uppercase mb-1">
                      {employeeType === 'sale'
                        ? 'Hoa Hồng Sale (Tự Đếm)'
                        : 'Sản Lượng / Hoa Hồng'}
                    </label>
                    {employeeType === 'sale' ? (
                      <div
                        title="Hoa hồng của Sale được tự động tính từ doanh số các nha khoa phụ trách, không chỉnh sửa thủ công"
                        className="w-full px-3 py-2 border border-teal-500/40 rounded-lg font-mono font-bold bg-slate-100 dark:bg-slate-900 text-teal-700 dark:text-teal-400 select-none cursor-not-allowed flex items-center justify-between"
                      >
                        <span>{formatVND(effectiveModalCommission)}</span>
                        <span className="text-[10px] font-sans font-semibold text-slate-400">
                          Tự động
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={50000}
                        value={commissionAmount}
                        onChange={(e) => setCommissionAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-teal-500/50 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-teal-700 dark:text-teal-400"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                      Thưởng Thêm / Tăng Ca
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={bonus}
                      onChange={(e) => setBonus(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-semibold bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-rose-600 dark:text-rose-400 uppercase mb-1">
                      Khấu Trừ / Tạm Ứng
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={deduction}
                      onChange={(e) => setDeduction(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-semibold bg-white dark:bg-slate-950 text-rose-600 dark:text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Trạng Thái Chi Trả
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as PayrollPaymentStatus)
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    >
                      <option value="unpaid">Chưa thanh toán</option>
                      <option value="paid">Đã thanh toán</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Ghi Chú Kỳ Này
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú thưởng ca răng, tạm ứng, phụ cấp trong tháng này..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Net Salary Preview Banner */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Tổng Thực Lĩnh Dự Kiến Kỳ{' '}
                  {editingRecord
                    ? editingRecord.monthYear
                    : selectedMonth === 'ALL'
                    ? latestMonth
                    : selectedMonth}
                </span>
                <span className="font-mono text-lg font-extrabold text-sky-400">
                  {formatVND(previewNetSalary)}
                </span>
              </div>

              {error && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Đang lưu...' : editingRecord ? 'Lưu Thay Đổi' : 'Thêm Vào Bảng Lương'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
