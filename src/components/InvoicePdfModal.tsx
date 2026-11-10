import React, { useState } from 'react';
import { DentalOrder, LabProfileConfig } from '../types/dental';
import { formatVND, DEFAULT_LAB_PROFILE } from '../utils/financeUtils';
import { displayMaterialName } from '../utils/materialDisplayName';
import { exportInvoiceToPdf } from '../utils/pdfExporter';
import {
  X,
  FileDown,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Check,
} from 'lucide-react';

interface InvoicePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: DentalOrder[];
  clinicName: string; // "" means "Tất cả nha khoa"
  monthYear: string; // "" means "Tất cả các tháng"
  paidAmount?: number;
  shippingFeeTotal?: number;
  previousMonthDebt?: number;
  additionalCharges?: number;
  discountAmount?: number;
  openingAdjustment?: number;
  orderSubtotal?: number;
  previousMonthLabel?: string;
  labProfile: LabProfileConfig;
}

export const InvoicePdfModal: React.FC<InvoicePdfModalProps> = ({
  isOpen,
  onClose,
  orders,
  clinicName,
  monthYear,
  paidAmount = 0,
  shippingFeeTotal = 0,
  previousMonthDebt = 0,
  additionalCharges = 0,
    discountAmount = 0,
    openingAdjustment = 0,
    orderSubtotal,
  previousMonthLabel = '',
  labProfile: rawProfile,
}) => {
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const labProfile: LabProfileConfig = {
    labName: rawProfile.labName || DEFAULT_LAB_PROFILE.labName,
    tagline: rawProfile.tagline || DEFAULT_LAB_PROFILE.tagline,
    hotline: rawProfile.hotline || DEFAULT_LAB_PROFILE.hotline,
    address: rawProfile.address || DEFAULT_LAB_PROFILE.address,
    email: rawProfile.email || DEFAULT_LAB_PROFILE.email,
    bankName: rawProfile.bankName || DEFAULT_LAB_PROFILE.bankName,
    bankAccountNumber:
      rawProfile.bankAccountNumber || DEFAULT_LAB_PROFILE.bankAccountNumber,
    bankAccountHolder:
      rawProfile.bankAccountHolder || DEFAULT_LAB_PROFILE.bankAccountHolder,
    directorName: rawProfile.directorName || DEFAULT_LAB_PROFILE.directorName,
  };

  const totalTeeth = orders.reduce((s, o) => s + (o.teethCount || 1), 0);
  const subtotal = orderSubtotal ?? orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const grandTotal = subtotal + previousMonthDebt + additionalCharges + shippingFeeTotal - discountAmount;
  const remainingBalance = Math.max(0, grandTotal - paidAmount - openingAdjustment);

  const clinicAddress =
    orders.find((o) => o.clinicAddress && o.clinicAddress.trim() !== '')
      ?.clinicAddress || 'Đà Nẵng';
  const clinicPhone =
    orders.find((o) => o.phone && o.phone.trim() !== '')?.phone || '';

  const invoiceCode = `HD-${monthYear ? monthYear.replace('/', '') : 'ALL'}-${
    clinicName
      ? clinicName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/gi, 'd')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 6)
      : 'TONGHOP'
  }`;

  const handleDownloadPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setDownloaded(false);
    try {
      await exportInvoiceToPdf({
        orders,
        clinicName,
        monthYear,
        paidAmount,
        shippingFeeTotal,
        previousMonthDebt,
        additionalCharges,
        discountAmount,
        openingAdjustment,
        orderSubtotal,
        previousMonthLabel,
        labProfile,
        invoiceCode,
      });
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-6">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <FileDown className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <span className="font-bold text-sm tracking-wide block">
                XUẤT HÓA ĐƠN & BẢNG KÊ ĐỐI SOÁT DOANH THU (PDF A4)
              </span>
              <span className="text-[11px] text-slate-400">
                Bấm &quot;Tải Xuống File PDF&quot; để lưu trực tiếp hóa đơn chuẩn A4 về máy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xuất PDF...</span>
                </>
              ) : downloaded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Đã tải xuống PDF</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Tải Xuống File PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* A4 INVOICE SHEET PREVIEW */}
        <div className="p-6 sm:p-10 bg-white text-slate-900">
          {/* Header: Lab Info & Invoice Meta */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-900">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-base">
                  AT
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    {labProfile.labName}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    {labProfile.tagline}
                  </p>
                </div>
              </div>
              <div className="pt-2 text-xs text-slate-600 space-y-0.5">
                <p>Địa chỉ: {labProfile.address}</p>
                <p>Hotline Kỹ Thuật & Kế Toán: {labProfile.hotline}</p>
                <p>
                  Tài khoản NH:{' '}
                  <strong className="text-slate-900">
                    {labProfile.bankAccountNumber}
                  </strong>{' '}
                  ({labProfile.bankName}) - Chủ TK:{' '}
                  <strong className="text-slate-900">
                    {labProfile.bankAccountHolder}
                  </strong>
                </p>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900">
                Số HĐ: {invoiceCode}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-teal-900 uppercase pt-1">
                HÓA ĐƠN / BẢNG KÊ PHỤC HÌNH RĂNG SỨ
              </h2>
              <p className="text-xs font-semibold text-slate-600">
                Kỳ kết toán:{' '}
                <span className="text-slate-900 font-bold">
                  {monthYear ? `Tháng ${monthYear}` : 'Toàn bộ các kỳ'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                Ngày lập bảng kê: {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Partner Clinic & Summary Highlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Đơn Vị Nha Khoa / Khách Hàng Đối Tác
              </div>
              <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>{clinicName || 'TỔNG HỢP TẤT CẢ NHA KHOA ĐỐI TÁC'}</span>
              </div>
              {clinicName && (
                <div className="text-slate-600 space-y-0.5 pt-0.5">
                  <p>
                    Địa chỉ phòng khám:{' '}
                    <span className="font-medium text-slate-800">
                      {clinicAddress}
                    </span>
                  </p>
                  {clinicPhone && (
                    <p>
                      Điện thoại liên hệ:{' '}
                      <span className="font-mono font-medium">
                        {clinicPhone}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-col justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                Tổng Cộng Phải Thanh Toán
              </div>
              <div className="text-xl font-black text-teal-950 font-mono my-1">
                {formatVND(remainingBalance)}
              </div>
              <div className="text-[11px] text-teal-700 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-teal-200/60">
                <span>
                  Tổng {orders.length} ca ({totalTeeth} răng)
                </span>
                {previousMonthDebt > 0 && (
                  <span className="font-mono font-bold text-amber-800">
                    +Nợ T{previousMonthLabel ? previousMonthLabel.split('/')[0] : 'trước'}:{' '}
                    {formatVND(previousMonthDebt)}
                  </span>
                )}
                {paidAmount > 0 && <span>Đã trả: {formatVND(paidAmount)}</span>}
              </div>
            </div>
          </div>

          {/* Detailed Line Items Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-2.5 text-center border-r border-slate-700 w-10">
                    STT
                  </th>
                  <th className="py-2.5 px-2.5 border-r border-slate-700">
                    Ngày Lắp
                  </th>
                  <th className="py-2.5 px-2.5 border-r border-slate-700">
                    Mã Thẻ BH
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700">
                    Họ Tên Bệnh Nhân
                  </th>
                  {!clinicName && (
                    <th className="py-2.5 px-3 border-r border-slate-700">
                      Nha Khoa
                    </th>
                  )}
                  <th className="py-2.5 px-3 border-r border-slate-700">
                    Dòng Sứ / Vật Liệu
                  </th>
                  <th className="py-2.5 px-2.5 border-r border-slate-700">
                    Vị Trí Răng
                  </th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-700">
                    SL Răng
                  </th>
                  <th className="py-2.5 px-3 text-right">Thành Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={clinicName ? 8 : 9}
                      className="py-6 text-center text-slate-400"
                    >
                      Không có ca phục hình phát sinh trong danh sách này.
                    </td>
                  </tr>
                ) : (
                  orders.map((o, idx) => (
                    <tr key={o.id} className="even:bg-slate-50/60">
                      <td className="py-2 px-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {o.orderDate}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {o.warrantyCode}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {o.patientName}
                      </td>
                      {!clinicName && (
                        <td className="py-2 px-3 text-slate-700 border-r border-slate-200">
                          {o.clinicName}
                        </td>
                      )}
                      <td className="py-2 px-3 text-slate-800 border-r border-slate-200">
                        {displayMaterialName(o.material)}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700 border-r border-slate-200 max-w-[140px] truncate">
                        {o.teeth}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 border-r border-slate-200">
                        {o.teethCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatVND(o.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td
                    colSpan={clinicName ? 6 : 7}
                    className="py-2.5 px-3 text-right uppercase text-xs"
                  >
                    {orderSubtotal === undefined ? `Tổng cộng tiền phục hình răng sứ (${orders.length} ca):` : 'Phát sinh theo bảng công nợ đã chốt:'}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-teal-900">
                    {totalTeeth} răng
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-teal-950">
                    {formatVND(subtotal)}
                  </td>
                </tr>
                {previousMonthDebt > 0 && (
                  <tr className="bg-amber-50/70 font-bold text-amber-900 border-t border-slate-200">
                    <td
                      colSpan={clinicName ? 7 : 8}
                      className="py-2.5 px-3 text-right uppercase text-xs"
                    >
                      Công nợ tháng trước{previousMonthLabel ? ` (Tháng ${previousMonthLabel})` : ''}:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-amber-800">
                      + {formatVND(previousMonthDebt)}
                    </td>
                  </tr>
                )}
                {additionalCharges > 0 && (
                  <tr className="bg-slate-50 font-semibold text-slate-700 border-t border-slate-200">
                    <td
                      colSpan={clinicName ? 7 : 8}
                      className="py-2 px-3 text-right text-xs"
                    >
                      Phát sinh công nợ nhập thêm trong kỳ:
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      + {formatVND(additionalCharges)}
                    </td>
                  </tr>
                )}
                {shippingFeeTotal > 0 && (
                  <tr className="bg-slate-50 font-semibold text-slate-700 border-t border-slate-200">
                    <td
                      colSpan={clinicName ? 7 : 8}
                      className="py-2 px-3 text-right text-xs"
                    >
                      Cước phí giao vận mẫu & phục hình:
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatVND(shippingFeeTotal)}
                    </td>
                  </tr>
                )}
                {discountAmount > 0 && (
                  <tr className="bg-teal-50 font-semibold text-teal-800">
                    <td colSpan={clinicName ? 7 : 8} className="py-2 px-3 text-right">Chiết khấu nha khoa:</td>
                    <td className="py-2 px-3 text-right font-mono">− {formatVND(discountAmount)}</td>
                  </tr>
                )}
                {paidAmount > 0 && (
                  <tr className="bg-emerald-50/60 font-semibold text-emerald-800 border-t border-slate-200">
                    <td
                      colSpan={clinicName ? 7 : 8}
                      className="py-2 px-3 text-right text-xs"
                    >
                      Số tiền đã thanh toán / tạm ứng trong kỳ:
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      - {formatVND(paidAmount)}
                    </td>
                  </tr>
                )}
                {openingAdjustment > 0 && (
                  <tr className="bg-slate-50 font-semibold text-slate-700">
                    <td colSpan={clinicName ? 7 : 8} className="py-2 px-3 text-right">Điều chỉnh theo số dư đã chốt:</td>
                    <td className="py-2 px-3 text-right font-mono">− {formatVND(openingAdjustment)}</td>
                  </tr>
                )}
                <tr className="bg-slate-900 text-white font-extrabold border-t border-slate-900">
                  <td
                    colSpan={clinicName ? 7 : 8}
                    className="py-3 px-3 text-right uppercase text-xs tracking-wide"
                  >
                    TỔNG SỐ TIỀN CÒN LẠI CẦN THANH TOÁN:
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-base text-teal-300">
                    {formatVND(remainingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment Notes & Signatures */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs pt-4 border-t border-slate-200">
            <div className="space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-teal-700" />
                Thông Tin Chuyển Khoản Thanh Toán:
              </div>
              <p>
                Ngân hàng: <strong>{labProfile.bankName}</strong>
              </p>
              <p>
                Số tài khoản:{' '}
                <strong className="font-mono text-sm text-slate-900">
                  {labProfile.bankAccountNumber}
                </strong>
              </p>
              <p>
                Chủ tài khoản: <strong>{labProfile.bankAccountHolder}</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Nội dung CK:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {clinicName || 'NhaKhoa'} TT {monthYear || 'CongNo'}
                </span>
              </p>
            </div>

            <div className="text-center">
              <span className="font-bold text-slate-900 block">
                Đại Diện Nha Khoa Đối Tác
              </span>
              <span className="text-[11px] text-slate-400">
                (Ký và ghi rõ họ tên)
              </span>
              <div className="h-20" />
              <span className="font-semibold text-slate-800">
                {clinicName || '........................'}
              </span>
            </div>

            <div className="text-center">
              <span className="font-bold text-slate-900 block">
                Đại Diện {labProfile.labName}
              </span>
              <span className="text-[11px] text-slate-400">
                (Ký xác nhận đối soát)
              </span>
              <div className="h-20 flex items-center justify-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> ĐÃ ĐỐI SOÁT SỐ LIỆU
                </span>
              </div>
              <span className="font-bold text-slate-900">
                {labProfile.directorName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
