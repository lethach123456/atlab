import type { ClinicPartner, DentalOrder } from '../types/dental';
import { normalizeClinicName } from './debtLedger';

export function getClinicPartnerNames(partner: ClinicPartner): string[] {
  return [partner.name, ...(Array.isArray(partner.previousNames) ? partner.previousNames : [])]
    .filter((name): name is string => typeof name === 'string' && !!name.trim());
}

/** All aliases point to one current profile, including deleted profiles. */
export function buildClinicPartnerIndex(partners: ClinicPartner[]): Map<string, ClinicPartner> {
  const index = new Map<string, ClinicPartner>();
  for (const partner of [...partners].sort((a, b) =>
    (a.updatedAt || 0) - (b.updatedAt || 0) || (a.id || '').localeCompare(b.id || '')
  )) {
    for (const name of getClinicPartnerNames(partner)) index.set(normalizeClinicName(name), partner);
  }
  return index;
}

export function createClinicNameResolver(partners: ClinicPartner[]): (name: string) => string {
  const index = buildClinicPartnerIndex(partners);
  return (name) => index.get(normalizeClinicName(name))?.name || name;
}

/** Deleted clinics stay in financial history but are excluded from new-order selectors. */
export function getClinicOptions(
  orders: Pick<DentalOrder, 'clinicName' | 'clinicAddress'>[],
  partners: ClinicPartner[]
): { name: string; address: string }[] {
  const index = buildClinicPartnerIndex(partners);
  const options = new Map<string, { name: string; address: string }>();
  for (const order of orders) {
    if (!order.clinicName?.trim()) continue;
    const partner = index.get(normalizeClinicName(order.clinicName));
    if (partner?.archived) continue;
    const name = partner?.name || order.clinicName.trim();
    const key = normalizeClinicName(name);
    const existing = options.get(key);
    const address = partner ? partner.address : order.clinicAddress?.trim() || '';
    if (!existing || partner || !existing.address || existing.address === 'Đà Nẵng') {
      options.set(key, { name, address });
    }
  }
  for (const partner of new Set(index.values())) {
    if (!partner.archived) options.set(normalizeClinicName(partner.name), {
      name: partner.name,
      address: partner.address,
    });
  }
  return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** Whitelist editable fields; IDs and deletion/alias metadata are managed by the app. */
export function validateClinicPartner(input: ClinicPartner): Required<Pick<ClinicPartner, 'name' | 'address' | 'phone' | 'discountPercent'>> {
  const name = input.name.trim().normalize('NFC').replace(/\s+/g, ' ');
  const address = input.address.trim();
  const phone = input.phone.trim();
  const discountPercent = input.discountPercent ?? 0;
  if (!name || name.length > 250 || !normalizeClinicName(name)) {
    throw new Error('Nhập tên nha khoa từ 1 đến 250 ký tự.');
  }
  if (address.length > 300 || phone.length > 50) {
    throw new Error('Địa chỉ tối đa 300 ký tự, số điện thoại tối đa 50 ký tự.');
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      Math.abs(discountPercent * 100 - Math.round(discountPercent * 100)) > 0.000001) {
    throw new Error('Chiết khấu từ 0 đến 100%, tối đa 2 chữ số thập phân.');
  }
  return { name, address, phone, discountPercent: Math.round(discountPercent * 100) / 100 };
}

export function prepareClinicPartnerChange(
  partners: ClinicPartner[],
  orders: Pick<DentalOrder, 'clinicName'>[],
  input: ClinicPartner,
  originalName: string | null,
  archived = false
) {
  const fields = validateClinicPartner(input);
  const index = buildClinicPartnerIndex(partners);
  const identityKey = normalizeClinicName(originalName || fields.name);
  const existing = index.get(identityKey);
  const newKey = normalizeClinicName(fields.name);
  const destination = index.get(newKey);
  if (destination && destination !== existing) {
    throw new Error('Tên nha khoa này đã có trong danh sách.');
  }
  if (!originalName && existing && !existing.archived) {
    throw new Error('Nha khoa này đã có trong danh sách. Bấm Sửa để cập nhật.');
  }
  const orderCollision = orders.some((order) => {
    const key = normalizeClinicName(order.clinicName);
    return key === newKey && key !== identityKey && (!existing || index.get(key) !== existing);
  });
  if (orderCollision || (!originalName && !existing && orders.some((order) => normalizeClinicName(order.clinicName) === newKey))) {
    throw new Error('Nha khoa này đã có trong danh sách. Bấm Sửa để cập nhật.');
  }

  const aliases = new Map<string, string>();
  for (const name of [...(existing ? getClinicPartnerNames(existing) : []), ...(originalName ? [originalName] : [])]) {
    const key = normalizeClinicName(name);
    if (key && key !== newKey) aliases.set(key, name.trim().normalize('NFC'));
  }
  if (aliases.size > 20) throw new Error('Nha khoa đã có quá nhiều tên cũ. Vui lòng giữ tên hiện tại.');
  return {
    existing,
    identityKey,
    data: {
      ...fields,
      ...(archived ? { address: '', phone: '', discountPercent: existing?.discountPercent ?? 0 } : {}),
      previousNames: Array.from(aliases.values()),
      archived,
    },
  };
}
