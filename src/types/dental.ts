export interface DentalOrder {
  id: string;
  warrantyCode: string; // Mã thẻ bảo hành / mã đơn (e.g. NS50205, UC10560, C296508)
  patientName: string; // Tên bệnh nhân / khách hàng
  phone: string; // Số điện thoại
  clinicName: string; // Tên nha khoa / bác sĩ
  clinicAddress: string; // Địa chỉ nha khoa
  material: string; // Loại sứ / vật liệu phục hình
  warrantyPeriod: string; // Thời hạn bảo hành gốc (e.g. "15 năm", "50 năm", "Trọn đời")
  warrantyYears: number; // Số năm bảo hành số (e.g. 15, 50, 99 cho trọn đời)
  orderDate: string; // Ngày gửi/lắp (DD/MM/YYYY)
  monthYear: string; // Chuẩn hóa "MM/YYYY" để lọc theo tháng dễ dàng (e.g. "10/2026")
  teeth: string; // Chuỗi vị trí răng (e.g. "14-24 34-44", "11-21", "Toàn hàm")
  teethCount: number; // Số lượng răng tính được
  toothForm: string; // Dáng răng (e.g. Form tự nhiên, Form thỏ nhẹ, Form Celeb, Oval)
  unitPrice: number; // Đơn giá Labo / 1 đơn vị răng (VNĐ)
  totalAmount: number; // Thành tiền = teethCount * unitPrice (VNĐ)
  shippingFee?: number; // Phí giao vận gắn với đơn (nếu có)
  shade?: string; // Màu răng (e.g. A1, A2, A3, OM1, B1)
  technician?: string; // Kỹ thuật viên
  notes?: string; // Ghi chú thêm
  status: '' | 'pending' | 'in_production' | 'completed' | 'delivered' | 'warranted';
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  createdAt: number;
}

export interface MaterialPriceConfig {
  id: string;
  materialKey: string; // Từ khóa nhận diện
  name: string;
  category: string;
  origin: string;
  unitPrice: number; // Đơn giá sỉ Labo tính cho Nha Khoa (VNĐ/răng)
  retailSuggestedPrice: number; // Giá nha khoa tham khảo (VNĐ/răng)
  defaultWarranty: string;
  strengthMpa: number;
}

export interface DebtPaymentRecord {
  id: string;
  clinicName: string;
  amount: number; // Số tiền thanh toán (VNĐ)
  paymentDate: string; // DD/MM/YYYY
  monthYear: string; // MM/YYYY
  method: 'transfer' | 'cash';
  referenceCode?: string;
  notes?: string;
  createdAt: number;
}

export interface ClinicDebtRecord {
  id: string;
  clinicName: string;
  monthYear: string; // MM/YYYY (e.g. "10/2026")
  openingSnapshot?: boolean; // Imported September statement replaces September order totals
  discountAmount?: number; // Fixed discount on the imported statement
  openingAdjustment?: number; // Difference between stated and calculated closing balance
  oldDebt: number; // Imported opening amount, or cached opening balance on later periods
  currentMonthDebt: number; // Manual charges added to this period's order revenue (VNĐ)
  totalDebt: number; // Cached displayed total, including automatically calculated revenue
  paidAmount: number; // Manual payments only; excludes debtPayments and carried credit
  remainingDebt: number; // Cached closing debt; recomputed from source entries by debtLedger
  orderIndex: number; // Thứ tự hiển thị theo bảng chuẩn
  notes?: string;
  updatedAt?: number;
}

export interface CashflowTransaction {
  id: string;
  type: 'income' | 'expense'; // Thu hoặc Chi
  category: string; // VD: "Thu công nợ nha khoa", "Mua phôi sứ & vật tư", "Lương kỹ thuật viên", "Chi phí giao vận", "Điện nước & vận hành"
  title: string;
  amount: number;
  date: string; // DD/MM/YYYY, or empty when only the accounting month is known
  monthYear: string; // MM/YYYY
  clinicName?: string; // Nếu gắn với nha khoa
  paymentMethod: '' | 'transfer' | 'cash';
  notes?: string;
  createdAt: number;
}

export interface DeliveryRecord {
  id: string;
  orderId?: string;
  warrantyCode: string;
  patientName: string;
  clinicName: string;
  clinicAddress: string;
  deliveryDate: string; // DD/MM/YYYY
  monthYear: string; // MM/YYYY
  direction: '' | 'pickup' | 'delivery' | 'both'; // Nhận mẫu / Giao răng / Khứ hồi, empty if unspecified
  courierName: string; // VD: "Shipper Labo (Nội thành)", "GrabExpress", "ViettelPost", "Xe khách tuyến Tỉnh"
  trackingCode?: string;
  shippingFee: number; // Số tiền giao vận (VNĐ)
  payer: '' | 'lab' | 'clinic'; // Labo chịu phí hay Nha khoa chịu phí, empty if unspecified
  status: '' | 'pending' | 'shipping' | 'delivered' | 'returned';
  notes?: string;
  createdAt: number;
}

export interface LabProfileConfig {
  labName: string;
  tagline: string;
  hotline: string;
  address: string;
  email: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  directorName: string;
}

export interface ClinicPartner {
  id?: string;
  name: string;
  address: string;
  phone: string;
  discountPercent?: number;
  archived?: boolean;
  previousNames?: string[];
  updatedAt?: number;
}

export interface ClinicSummary {
  name: string;
  address: string;
  phone: string;
  totalOrders: number;
  totalTeeth: number;
  totalRevenue: number;
  topMaterial: string;
  lastOrderDate: string;
}

export interface MaterialInfo {
  name: string;
  category: string;
  origin: string;
  strengthMpa: number;
  translucency: string;
  defaultWarranty: string;
  indications: string;
  description: string;
  badgeColor: string;
}

export interface FilterState {
  search: string;
  clinic: string;
  material: string;
  warranty: string;
  toothForm: string;
  year: string;
  status: string;
}
