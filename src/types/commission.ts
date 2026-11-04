export interface SaleCommission {
  id: string;
  saleId: string;
  clinicName: string;
  ratePercent: number;
}

export type CommissionInput = Omit<SaleCommission, 'id'>;
