import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClinicPartner, DentalOrder } from '../types/dental';
import { DEFAULT_LAB_PROFILE } from './financeUtils';
import { calculateDebtRows, normalizeClinicName } from './debtLedger';
import {
  buildClinicPartnerIndex,
  createClinicNameResolver,
  getClinicOptions,
  prepareClinicPartnerChange,
  validateClinicPartner,
} from './clinicPartners';
import { resolveWorkspaceClinicNames, type WorkspaceData } from '../services/workspaceData';

const profile = (overrides: Partial<ClinicPartner> = {}): ClinicPartner => ({
  id: 'partner_stable', name: 'Lăng Cô', address: 'Địa chỉ mới', phone: '0905000000',
  discountPercent: 2.5, updatedAt: 100, ...overrides,
});
const order = (id: string, clinicName: string, monthYear = '10/2026', totalAmount = 1_000_000): DentalOrder => ({
  id, clinicName, monthYear, totalAmount, warrantyCode: id, patientName: 'Khách hàng',
  phone: '', clinicAddress: 'Địa chỉ cũ', material: 'Zirconia', warrantyPeriod: '15 năm',
  warrantyYears: 15, orderDate: `01/${monthYear}`, teeth: '11', teethCount: 1,
  toothForm: '', unitPrice: totalAmount, status: '', createdAt: 1,
});

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test('new partner validates editable fields and defaults discount to zero', () => {
  const next = prepareClinicPartnerChange([], [], { name: '  Nha khoa   Mới  ', address: '  Địa chỉ ', phone: ' 0905 ' }, null);
  assert.equal(next.existing, undefined);
  assert.equal(next.identityKey, normalizeClinicName('Nha khoa Mới'));
  assert.deepEqual(next.data, {
    name: 'Nha khoa Mới', address: 'Địa chỉ', phone: '0905', discountPercent: 0,
    previousNames: [], archived: false,
  });
});

test('rename retains stable profile identity and every previous alias', () => {
  const existing = profile({ previousNames: ['Lăng Cô cũ'] });
  const first = prepareClinicPartnerChange([existing], [order('old', 'Lăng Cô')],
    { name: 'Lăng Cô Mới', address: '', phone: '', discountPercent: 3.25 }, 'Lăng Cô');
  assert.equal(first.existing?.id, 'partner_stable');
  assert.equal(first.identityKey, normalizeClinicName('Lăng Cô'));
  assert.deepEqual(new Set(first.data.previousNames), new Set(['Lăng Cô cũ', 'Lăng Cô']));
  const updated = { ...first.data, id: first.existing?.id, updatedAt: 200 };
  const second = prepareClinicPartnerChange([updated], [order('old', 'Lăng Cô')],
    { name: 'Lăng Cô Sau', address: 'Khác', phone: '', discountPercent: 4 }, 'Lăng Cô Mới');
  assert.equal(second.existing?.id, 'partner_stable');
  const resolve = createClinicNameResolver([{ ...second.data, id: 'partner_stable' }]);
  for (const name of ['Lăng Cô cũ', 'Lăng Cô', 'Lăng Cô Mới']) assert.equal(resolve(name), 'Lăng Cô Sau');
});

test('editing an order-derived clinic upserts without changing its source identity', () => {
  const next = prepareClinicPartnerChange([], [order('old', 'Lăng Cô')],
    { name: 'Lăng Cô Mới', address: '', phone: '', discountPercent: 1 }, 'Lăng Cô');
  assert.equal(next.existing, undefined);
  assert.equal(next.identityKey, normalizeClinicName('Lăng Cô'));
  assert(next.data.previousNames.includes('Lăng Cô'));
});

test('rename cannot take the name of a different order-derived clinic', () => {
  const existing = profile();
  assert.throws(() => prepareClinicPartnerChange([existing], [order('other', 'Tâm An')],
    profile({ name: 'Nha khoa TÂM AN' }), 'Lăng Cô'), /đã có/);
  // Both profiles are derived from orders, so neither index lookup has a value.
  assert.throws(() => prepareClinicPartnerChange([], [order('old', 'Lăng Cô'), order('other', 'Tâm An')],
    profile({ name: 'Tâm An' }), 'Lăng Cô'), /đã có/);
});

test('rename cannot take a registered clinic name or any of its aliases', () => {
  const original = profile();
  const other = profile({ id: 'partner_other', name: 'Tâm An', previousNames: ['Tâm An Cũ'] });
  for (const name of ['Tâm An', 'NHA KHOA Tâm An Cũ']) {
    assert.throws(() => prepareClinicPartnerChange([original, other], [], profile({ name }), 'Lăng Cô'), /đã có/);
  }
});

test('add rejects registered and order-derived duplicate names despite formatting differences', () => {
  assert.throws(() => prepareClinicPartnerChange([profile()], [], profile({ name: ' Nha khoa LĂNG   CÔ ' }), null), /đã có/);
  assert.throws(() => prepareClinicPartnerChange([], [order('source', 'Lăng Cô')], profile(), null), /đã có/);
});

test('adding an archived name restores the same profile and retains historical aliases', () => {
  const archived = profile({ archived: true, previousNames: ['Lăng Cô cũ'], address: '', phone: '' });
  const next = prepareClinicPartnerChange([archived], [order('historic', 'Lăng Cô cũ')],
    profile({ address: 'Địa chỉ khôi phục', phone: '0906', discountPercent: 7.5 }), null);
  assert.equal(next.existing?.id, archived.id);
  assert.equal(next.data.archived, false);
  assert(next.data.previousNames.includes('Lăng Cô cũ'));
  assert.equal(next.data.discountPercent, 7.5);
});

test('archive excludes current and previous names from selectors but preserves history identity', () => {
  const existing = profile({ previousNames: ['Lăng Cô Cũ'] });
  const archived = prepareClinicPartnerChange([existing], [],
    profile({ address: '', phone: '', discountPercent: 0 }), 'Lăng Cô', true);
  assert.equal(archived.data.archived, true);
  assert.equal(archived.existing?.id, existing.id);
  const orders = [order('current', 'Lăng Cô'), order('historic', 'Nha khoa Lăng Cô Cũ'), order('other', 'Tâm An')];
  const partners = [{ ...archived.data, id: existing.id }];
  assert.deepEqual(getClinicOptions(orders, partners).map((option) => option.name), ['Tâm An']);
  assert.equal(createClinicNameResolver(partners)('Nha khoa Lăng Cô Cũ'), 'Lăng Cô');
  assert.equal(orders[1].clinicName, 'Nha khoa Lăng Cô Cũ');
});

test('blank partner metadata overrides addresses inferred from old orders', () => {
  const partners = [profile({ address: '', phone: '', previousNames: ['Lăng Cô Cũ'] })];
  assert.deepEqual(getClinicOptions([order('old', 'Lăng Cô Cũ')], partners), [{ name: 'Lăng Cô', address: '' }]);
  const next = prepareClinicPartnerChange(partners, [], profile({ address: '', phone: '' }), 'Lăng Cô');
  assert.equal(next.data.address, '');
  assert.equal(next.data.phone, '');
});

test('discount accepts zero, full discount and exact hundredths without losing precision', () => {
  for (const discountPercent of [0, 100, 2.5, 1.1, 0.01, 99.99]) {
    assert.equal(validateClinicPartner(profile({ discountPercent })).discountPercent, discountPercent);
  }
});

test('discount rejects negative, over-100, non-finite and overly precise rates', () => {
  for (const discountPercent of [-0.01, 100.01, Number.NaN, Infinity, -Infinity, 1.234]) {
    assert.throws(() => validateClinicPartner(profile({ discountPercent })), /Chiết khấu/);
  }
});

test('name and contact fields respect their stored limits', () => {
  for (const input of [profile({ name: '' }), profile({ name: 'x'.repeat(251) }),
    profile({ address: 'x'.repeat(301) }), profile({ phone: 'x'.repeat(51) })]) {
    assert.throws(() => validateClinicPartner(input));
  }
});

test('change preparation ignores forged identity, aliases and archive fields in editable input', () => {
  const existing = profile({ previousNames: ['Lăng Cô Cũ'] });
  const next = prepareClinicPartnerChange([existing], [], profile({
    id: 'forged_id', previousNames: ['Tên người khác'], archived: true, name: 'Lăng Cô Mới',
  }), 'Lăng Cô');
  assert.equal(next.existing?.id, 'partner_stable');
  assert.equal(next.data.archived, false);
  assert(!next.data.previousNames.includes('Tên người khác'));
  assert(!('id' in next.data));
});

test('newest profile snapshot wins duplicate aliases regardless of input order', () => {
  const old = profile({ id: 'old', updatedAt: 1 });
  const newest = profile({ id: 'new', name: 'Lăng Cô Mới', previousNames: ['Lăng Cô'], updatedAt: 2 });
  for (const rows of [[old, newest], [newest, old]]) {
    assert.equal(buildClinicPartnerIndex(rows).get(normalizeClinicName('Lăng Cô'))?.id, 'new');
  }
});

function workspace(): WorkspaceData {
  return {
    orders: [order('september', 'Tên Cũ', '09/2026', 2_000_000), order('october', 'Tên Mới', '10/2026', 3_000_000)],
    debts: [{ id: 'debt', clinicName: 'Tên Cũ', monthYear: '10/2026', oldDebt: 99_000_000,
      currentMonthDebt: 500_000, totalDebt: 99_000_000, paidAmount: 500_000, remainingDebt: 99_000_000, orderIndex: 1 }],
    payments: [{ id: 'receipt', clinicName: 'Nha khoa TÊN CŨ', monthYear: '10/2026', amount: 5_000_000,
      paymentDate: '05/11/2026', method: 'transfer', createdAt: 1 }],
    cashflows: [{ id: 'cash', clinicName: 'Tên Cũ', monthYear: '10/2026', type: 'income', category: 'Thu công nợ nha khoa',
      title: 'Phiếu thu', amount: 5_000_000, date: '05/11/2026', paymentMethod: 'transfer', createdAt: 1 },
      { id: 'general', monthYear: '10/2026', type: 'expense', category: 'Vật liệu', title: 'Vật liệu', amount: 200_000,
        date: '', paymentMethod: 'cash', createdAt: 1 }],
    deliveries: [{ id: 'delivery', clinicName: 'Tên Cũ', monthYear: '10/2026', clinicAddress: '', deliveryDate: '01/10/2026',
      warrantyCode: '', patientName: '', direction: '', courierName: '', shippingFee: 30_000, payer: 'lab', status: '', createdAt: 1 }],
    partners: [profile({ name: 'Tên Mới', previousNames: ['Tên Cũ'] })], prices: [], clinicPrices: [], profile: { ...DEFAULT_LAB_PROFILE },
  };
}

test('workspace resolution canonicalizes all five business collections without modifying financial amounts or source records', () => {
  const source = freeze(workspace());
  const before = structuredClone(source);
  const result = resolveWorkspaceClinicNames(source);
  for (const key of ['orders', 'debts', 'payments', 'deliveries', 'cashflows'] as const) {
    const original = source[key] as { clinicName?: string }[];
    const next = result[key] as { clinicName?: string }[];
    assert.equal(next.length, original.length);
    for (let i = 0; i < original.length; i++) {
      const { clinicName: _oldName, ...oldFields } = original[i];
      const { clinicName, ...fields } = next[i];
      assert.deepEqual(fields, oldFields);
      assert.equal(clinicName, original[i].clinicName ? 'Tên Mới' : undefined);
    }
  }
  assert.deepEqual(source, before);
  assert.equal(result.partners, source.partners);
  assert.equal(result.prices, source.prices);
  assert.equal(result.profile, source.profile);
});

test('renamed clinic retains September and October settlement links in the debt ledger', () => {
  const data = resolveWorkspaceClinicNames(workspace());
  const rows = calculateDebtRows(data.orders, data.debts, data.payments, '11/2026');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clinicName, 'Tên Mới');
  assert.equal(rows[0].oldDebt, 0);
  assert.equal(rows[0].remainingDebt, 0);
});

test('archiving a partner does not hide or change its historical business records', () => {
  const source = workspace();
  source.partners[0].archived = true;
  const result = resolveWorkspaceClinicNames(freeze(source));
  for (const key of ['orders', 'debts', 'payments', 'deliveries', 'cashflows'] as const) {
    assert.equal(result[key].length, source[key].length);
  }
  assert.equal(calculateDebtRows(result.orders, result.debts, result.payments, '11/2026')[0].remainingDebt, 0);
  assert.deepEqual(getClinicOptions(result.orders, result.partners), []);
});
