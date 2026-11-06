const normalizeIdentity = value => typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi') : '';

/** Build a response from rows belonging to one warranty card. */
export function buildWarrantyResult(code, rows) {
  const identities = new Set(rows.map(row => [row.ownerId, normalizeIdentity(row.patientName), normalizeIdentity(row.clinicName)].join('\u0000')));
  if (identities.size !== 1 || rows.some(row => !row.ownerId || !normalizeIdentity(row.patientName) || !normalizeIdentity(row.clinicName))) {
    return null;
  }
  const positions = [];
  const seen = new Set();
  for (const row of rows) {
    // Keep the original notation: it may contain ranges or non-FDI descriptions.
    for (const position of String(row.teeth || '').split(/[,;\n]+/).map(part => part.trim()).filter(Boolean)) {
      const key = normalizeIdentity(position);
      if (!seen.has(key)) { seen.add(key); positions.push(position); }
    }
  }
  const restorations = rows.map(row => ({
    patientName: typeof row.patientName === 'string' ? row.patientName : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    clinicName: typeof row.clinicName === 'string' ? row.clinicName : '',
    clinicAddress: typeof row.clinicAddress === 'string' ? row.clinicAddress : '',
    material: typeof row.material === 'string' ? row.material : '',
    teeth: typeof row.teeth === 'string' ? row.teeth : '',
    teethCount: typeof row.teethCount === 'number' ? row.teethCount : 0,
    warrantyPeriod: typeof row.warrantyPeriod === 'string' ? row.warrantyPeriod : '',
    warrantyYears: typeof row.warrantyYears === 'number' ? row.warrantyYears : 0,
    orderDate: typeof row.orderDate === 'string' ? row.orderDate : '',
    toothForm: typeof row.toothForm === 'string' ? row.toothForm : '',
    status: typeof row.status === 'string' ? row.status : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    totalAmount: typeof row.totalAmount === 'number' ? row.totalAmount : 0,
    unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : 0,
    paymentStatus: typeof row.paymentStatus === 'string' ? row.paymentStatus : '',
    monthYear: typeof row.monthYear === 'string' ? row.monthYear : '',
    shippingFee: typeof row.shippingFee === 'number' ? row.shippingFee : null,
    shade: typeof row.shade === 'string' ? row.shade : '',
    technician: typeof row.technician === 'string' ? row.technician : '',
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    warrantyCode: code,
    patientName: rows[0].patientName,
    phone: typeof rows[0].phone === 'string' ? rows[0].phone : '',
    clinicName: rows[0].clinicName,
    clinicAddress: typeof rows[0].clinicAddress === 'string' ? rows[0].clinicAddress : '',
    teeth: positions.join(', '),
    restorations,
  };
}
