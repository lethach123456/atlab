import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClinicDebtRecord, DebtPaymentRecord, DentalOrder } from '../types/dental';
import { calculateDebtRows, normalizeClinicName } from './debtLedger';

const clinic = 'Lăng Cô';

function order(id: string, monthYear: string, totalAmount: number, clinicName = clinic): DentalOrder {
  return {
    id, monthYear, totalAmount, clinicName,
    warrantyCode: id, patientName: 'Khách hàng', phone: '', clinicAddress: '',
    material: 'Zirconia', warrantyPeriod: '15 năm', warrantyYears: 15,
    orderDate: `01/${monthYear}`, teeth: '11', teethCount: 1, toothForm: '',
    unitPrice: totalAmount, status: '', createdAt: 1,
  };
}

function payment(id: string, monthYear: string, amount: number, clinicName = clinic): DebtPaymentRecord {
  return { id, monthYear, amount, clinicName, paymentDate: `20/${monthYear}`, method: 'transfer', createdAt: 1 };
}

function record(
  id: string,
  monthYear: string,
  overrides: Partial<ClinicDebtRecord> = {},
): ClinicDebtRecord {
  return {
    id, monthYear, clinicName: clinic, oldDebt: 0, currentMonthDebt: 0,
    totalDebt: 0, paidAmount: 0, remainingDebt: 0, orderIndex: 1, updatedAt: 1,
    ...overrides,
  };
}

function oneRow(
  orders: DentalOrder[],
  records: ClinicDebtRecord[],
  payments: DebtPaymentRecord[],
  month: string,
) {
  const rows = calculateDebtRows(orders, records, payments, month);
  assert.equal(rows.length, 1);
  return rows[0];
}

test('September begins at zero and excludes transactions before September 2026', () => {
  const row = oneRow(
    [order('august', '08/2026', 8_000_000), order('september', '09/2026', 2_000_000)],
    [record('august', '08/2026', { currentMonthDebt: 7_000_000, paidAmount: 9_000_000 }),
      record('september', '09/2026', { oldDebt: 10_000_000, totalDebt: 10_000_000 })],
    [payment('august', '08/2026', 3_000_000)],
    '09/2026',
  );
  assert.equal(row.oldDebt, 0);
  assert.equal(row.currentMonthDebt, 2_000_000);
  assert.equal(row.paidAmount, 0);
  assert.equal(row.remainingDebt, 2_000_000);
});

test('full October settlement leaves no old debt in November', () => {
  const orders = [order('september', '09/2026', 2_000_000), order('october', '10/2026', 3_000_000)];
  const payments = [payment('october', '10/2026', 5_000_000)];
  const october = oneRow(orders, [], payments, '10/2026');
  assert.equal(october.oldDebt, 2_000_000);
  assert.equal(october.currentMonthDebt, 3_000_000);
  assert.equal(october.paidAmount, 5_000_000);
  assert.equal(october.remainingDebt, 0);
  const november = oneRow(orders, [], payments, '11/2026');
  assert.equal(november.oldDebt, 0);
  assert.equal(november.currentMonthDebt, 0);
  assert.equal(november.paidAmount, 0);
  assert.equal(november.remainingDebt, 0);
});

test('partial settlement carries only the unpaid remainder across multiple months', () => {
  const orders = [order('september', '09/2026', 2_000_000), order('october', '10/2026', 3_000_000),
    order('november', '11/2026', 4_000_000)];
  const payments = [payment('october', '10/2026', 4_000_000), payment('november', '11/2026', 2_000_000)];
  const november = oneRow(orders, [], payments, '11/2026');
  assert.equal(november.oldDebt, 1_000_000);
  assert.equal(november.currentMonthDebt, 4_000_000);
  assert.equal(november.remainingDebt, 3_000_000);
  const december = oneRow(orders, [], payments, '12/2026');
  assert.equal(december.oldDebt, 3_000_000);
  assert.equal(december.currentMonthDebt, 0);
  assert.equal(december.remainingDebt, 3_000_000);
});

test('deleting or editing a historical payment recomputes later opening balances', () => {
  const orders = [order('october', '10/2026', 5_000_000)];
  assert.equal(oneRow(orders, [], [payment('paid', '10/2026', 5_000_000)], '11/2026').oldDebt, 0);
  assert.equal(oneRow(orders, [], [payment('paid', '10/2026', 1_500_000)], '11/2026').oldDebt, 3_500_000);
  assert.equal(oneRow(orders, [], [], '11/2026').oldDebt, 5_000_000);
});

test('manual payment stored on an October row remains deducted in later months', () => {
  const row = oneRow(
    [order('october', '10/2026', 5_000_000)],
    [record('october', '10/2026', { paidAmount: 3_000_000, oldDebt: 50_000_000 })],
    [payment('receipt', '10/2026', 2_000_000)],
    '11/2026',
  );
  assert.equal(row.oldDebt, 0);
  assert.equal(row.remainingDebt, 0);
});

test('manual charges are added once and snapshot total/remaining values are not carried again', () => {
  const records = [record('october', '10/2026', {
    oldDebt: 9_000_000, currentMonthDebt: 500_000, totalDebt: 99_000_000,
    remainingDebt: 99_000_000, paidAmount: 200_000,
  })];
  const orders = [order('october', '10/2026', 1_000_000)];
  const october = oneRow(orders, records, [], '10/2026');
  assert.equal(october.autoOrderDebt, 1_000_000);
  assert.equal(october.manualCurrentDebt, 500_000);
  assert.equal(october.currentMonthDebt, 1_500_000);
  assert.equal(october.paidFromRecords, 200_000);
  assert.equal(october.remainingDebt, 1_300_000);
  const december = oneRow(orders, records, [], '12/2026');
  assert.equal(december.oldDebt, 1_300_000);
  assert.equal(december.currentMonthDebt, 0);
});

test('duplicate clinic names and snapshots produce one row and one deduction', () => {
  const row = oneRow(
    [order('one', '10/2026', 5_000_000, '  Nha khoa Lăng   Cô  ')],
    [record('older', '10/2026', { clinicName: 'LĂNG CÔ', paidAmount: 1_000_000, updatedAt: 1 }),
      record('newer', '10/2026', { clinicName: 'Lăng Cô', paidAmount: 2_000_000, updatedAt: 2 }),
      record('november', '11/2026', { clinicName: 'lăng cô', oldDebt: 50_000_000 })],
    [payment('receipt', '10/2026', 3_000_000, 'nha khoa LĂNG CÔ')],
    '11/2026',
  );
  assert.equal(row.oldDebt, 0);
  assert.equal(row.remainingDebt, 0);
});

test('duplicate snapshot choice is deterministic when update times tie', () => {
  const first = record('first', '10/2026', { paidAmount: 1_000_000, orderIndex: 1 });
  const second = record('second', '10/2026', { paidAmount: 2_000_000, orderIndex: 2 });
  const orders = [order('october', '10/2026', 5_000_000)];
  const forward = oneRow(orders, [first, second], [], '10/2026');
  const reversed = oneRow(orders, [second, first], [], '10/2026');
  assert.equal(forward.paidFromRecords, 1_000_000);
  assert.equal(reversed.paidFromRecords, 1_000_000);
});

test('legacy id prefixes cannot merge Lăng Cô with 3T - Sông Vệ or duplicate its debt', () => {
  const otherClinic = '3T - Sông Vệ';
  const rows = calculateDebtRows(
    [order('lang-co-october', '10/2026', 3_400_000),
      order('song-ve-october', '10/2026', 5_400_000, otherClinic)],
    [record('debt_2026_10_2', '10/2026', { clinicName: otherClinic, oldDebt: 5_400_000, orderIndex: 2 }),
      record('debt_2026_10_22', '10/2026', { oldDebt: 10_700_000, orderIndex: 22 }),
      record('debt_2026_10_22_11_2026', '11/2026', { oldDebt: 10_700_000, orderIndex: 22 })],
    [payment('lang-co-paid', '11/2026', 3_400_000)], '11/2026',
  );
  assert.equal(rows.length, 2);
  const langCo = rows.filter(row => normalizeClinicName(row.clinicName) === normalizeClinicName(clinic));
  assert.equal(langCo.length, 1);
  assert.equal(langCo[0].id, 'debt_2026_10_22_11_2026');
  assert.equal(langCo[0].oldDebt, 3_400_000);
  assert.equal(langCo[0].paidFromPayments, 3_400_000);
  assert.equal(langCo[0].remainingDebt, 0);
  const songVe = rows.find(row => normalizeClinicName(row.clinicName) === normalizeClinicName(otherClinic));
  assert.ok(songVe);
  assert.equal(songVe.oldDebt, 5_400_000);
  assert.equal(songVe.paidFromPayments, 0);
  assert.equal(songVe.remainingDebt, 5_400_000);
});

test('repeated copies of the same order or receipt are counted once by id', () => {
  const entry = order('one', '10/2026', 5_000_000);
  const receipt = payment('one', '10/2026', 2_000_000);
  const row = oneRow([entry, { ...entry }], [], [receipt, { ...receipt }], '10/2026');
  assert.equal(row.currentMonthDebt, 5_000_000);
  assert.equal(row.paidFromPayments, 2_000_000);
  assert.equal(row.orders.length, 1);
  assert.equal(row.remainingDebt, 3_000_000);
});

test('a clinic payment cannot settle another clinic or create a second clinic row', () => {
  const rows = calculateDebtRows(
    [order('lang-co', '10/2026', 5_000_000), order('tam-an', '10/2026', 9_000_000, 'Tâm An')],
    [], [payment('lang-co-paid', '10/2026', 5_000_000, 'Nha khoa Lăng Cô')], '11/2026',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => normalizeClinicName(row.clinicName) === normalizeClinicName(clinic))?.oldDebt, 0);
  assert.equal(rows.find(row => normalizeClinicName(row.clinicName) === normalizeClinicName('Tâm An'))?.oldDebt, 9_000_000);
});

test('a receipt applies to its selected debt period even when collected in the following month', () => {
  const receipt = { ...payment('paid', '10/2026', 5_000_000), paymentDate: '05/11/2026' };
  const row = oneRow([order('october', '10/2026', 5_000_000)], [], [receipt], '11/2026');
  assert.equal(row.oldDebt, 0);
  assert.equal(row.paidFromPayments, 0);
  assert.equal(row.remainingDebt, 0);
});

test('overpayment is retained as credit and offsets later charges', () => {
  const orders = [order('october', '10/2026', 5_000_000), order('november', '11/2026', 1_000_000),
    order('december', '12/2026', 2_000_000)];
  const payments = [payment('october', '10/2026', 7_000_000)];
  const november = oneRow(orders, [], payments, '11/2026');
  assert.equal(november.oldDebt, 0);
  assert.equal(november.carriedCredit, 2_000_000);
  assert.equal(november.remainingDebt, 0);
  assert.equal(november.balance, -1_000_000);
  const december = oneRow(orders, [], payments, '12/2026');
  assert.equal(december.oldDebt, 0);
  assert.equal(december.carriedCredit, 1_000_000);
  assert.equal(december.remainingDebt, 1_000_000);
});

test('future orders, payments and manual snapshots cannot change an earlier period', () => {
  const row = oneRow(
    [order('october', '10/2026', 5_000_000), order('november', '11/2026', 99_000_000)],
    [record('future', '11/2026', { paidAmount: 50_000_000, currentMonthDebt: 50_000_000 })],
    [payment('future', '11/2026', 99_000_000)],
    '10/2026',
  );
  assert.equal(row.oldDebt, 0);
  assert.equal(row.currentMonthDebt, 5_000_000);
  assert.equal(row.paidAmount, 0);
  assert.equal(row.remainingDebt, 5_000_000);
});

test('closing balance carries across December to January without repeating charges', () => {
  const row = oneRow(
    [order('december', '12/2026', 5_000_000), order('january', '01/2027', 2_000_000)],
    [], [payment('december', '12/2026', 3_000_000)], '01/2027',
  );
  assert.equal(row.oldDebt, 2_000_000);
  assert.equal(row.currentMonthDebt, 2_000_000);
  assert.equal(row.remainingDebt, 4_000_000);
});

test('malformed or pre-start target periods do not produce a debt ledger', () => {
  for (const month of ['', 'ALL', '13/2026', '00/2026', '09/26', '08/2026']) {
    assert.deepEqual(calculateDebtRows([order('one', '09/2026', 1_000_000)], [], [], month), []);
  }
});

test('malformed transaction months are ignored', () => {
  const row = oneRow(
    [order('valid', '09/2026', 1_000_000), order('bad', '13/2026', 99_000_000)],
    [record('bad', 'bad', { currentMonthDebt: 99_000_000 })],
    [payment('bad', '00/2026', 99_000_000)], '09/2026',
  );
  assert.equal(row.remainingDebt, 1_000_000);
});

test('clinic identity normalizes prefixes, spacing, Unicode and existing spelling variants', () => {
  assert.equal(normalizeClinicName('  Nha khoa LĂNG   CÔ  '), normalizeClinicName('Lăng Cô'));
  assert.equal(normalizeClinicName('Thuỷ Phan'), normalizeClinicName('Thủy Phan'));
  assert.equal(normalizeClinicName('Lăng Cô'.normalize('NFD')), normalizeClinicName('Lăng Cô'));
  assert.notEqual(normalizeClinicName('Lăng Cô'), normalizeClinicName('Lăng Cô 2'));
});

test('imported September statement replaces order charges and carries fixed discounts once', () => {
  const orders = [
    order('sept-listed', '09/2026', 19_000_000),
    order('sept-unlisted', '09/2026', 30_000_000, 'Nha khoa khác'),
    order('october', '10/2026', 4_000_000),
  ];
  const snapshot = record('opening', '09/2026', {
    openingSnapshot: true, oldDebt: 5_000_000, currentMonthDebt: 4_000_000,
    discountAmount: 600_000, paidAmount: 2_000_000,
  });
  const rates = new Map([[normalizeClinicName(clinic), 10]]);
  const september = calculateDebtRows(orders, [snapshot], [], '09/2026', rates);
  assert.equal(september.length, 1);
  assert.equal(september[0].remainingDebt, 6_400_000);
  const october = calculateDebtRows(orders, [snapshot], [], '10/2026', rates)[0];
  assert.equal(october.oldDebt, 6_400_000);
  assert.equal(october.discountAmount, 400_000);
  assert.equal(october.remainingDebt, 10_000_000);
  const november = calculateDebtRows(orders, [snapshot], [], '11/2026', rates)[0];
  assert.equal(november.oldDebt, 10_000_000);
  assert.equal(november.discountAmount, 0);
});

test('a discounted clinic that pays its net balance carries no debt to the next period', () => {
  const orders = [order('october', '10/2026', 100_000)];
  const rates = new Map([[normalizeClinicName(clinic), 12.5]]);
  const rows = calculateDebtRows(orders, [], [payment('october', '10/2026', 87_500)], '11/2026', rates);
  assert.equal(rows[0].oldDebt, 0);
  assert.equal(rows[0].carriedCredit, 0);
});
