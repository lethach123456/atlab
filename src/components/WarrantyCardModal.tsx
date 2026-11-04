import React from 'react';
import { DentalOrder } from '../types/dental';
import { parseTeethNotation, ALL_ADULT_TEETH } from '../utils/fdiTeeth';
import { X, Printer, ShieldCheck, Award, Sparkles, Building2, Phone, Calendar, CheckCircle2 } from 'lucide-react';

interface WarrantyCardModalProps {
  order: DentalOrder | null;
  onClose: () => void;
}

export const WarrantyCardModal: React.FC<WarrantyCardModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const teethInfo = parseTeethNotation(order.teeth);
  const activeTeeth = new Set(teethInfo.toothIds);

  // Calculate expiration date
  const calculateExpiry = (dateStr: string, years: number) => {
    if (years >= 90) return 'Trọn đời (Vĩnh viễn)';
    try {
      const parts = dateStr.split(/[\/-]/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + years}`;
        }
      }
    } catch {
      // fallback
    }
    return `${years} năm kể từ ngày lắp`;
  };

  const expiryDate = calculateExpiry(order.orderDate, order.warrantyYears);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm tracking-wide">
              THẺ BẢO HÀNH ĐIỆN TỬ CHÍNH HÃNG AT DENTAL LAB
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              In Thẻ Bảo Hành
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE LUXURY WARRANTY CARD CANVAS */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50 via-white to-slate-50 relative print:p-8 print:m-0 print:border-none">
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500/60 pointer-events-none" />
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500/60 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500/60 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500/60 pointer-events-none" />

          {/* Certificate Inner Border */}
          <div className="border border-amber-300/60 rounded-xl p-5 sm:p-7 bg-white/90 relative shadow-xs">
            {/* Watermark Logo in background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none overflow-hidden">
              <span className="text-[120px] font-black tracking-tighter text-slate-900 select-none">
                AT LAB
              </span>
            </div>

            {/* Header section */}
            <div className="text-center pb-5 mb-5 border-b border-amber-200/80 relative">
              <div className="flex items-center justify-center gap-2 text-amber-700 font-semibold text-xs tracking-widest uppercase mb-1">
                <Award className="w-4 h-4 text-amber-600" />
                Chứng Nhận Phục Hình Răng Sứ Chính Hãng
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                AT DENTAL LABORATORY
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                TRUNG TÂM RĂNG SỨ CHẤT LƯỢNG CAO · CAD/CAM DIGITAL LAB
              </p>

              {/* Warranty Card Badge / Code */}
              <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-300 rounded-full">
                <span className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                  Mã thẻ bảo hành:
                </span>
                <span className="font-mono text-sm font-bold text-teal-950">
                  {order.warrantyCode}
                </span>
              </div>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm relative">
              {/* Left Column: Patient & Clinic */}
              <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                  <span>Thông Tin Khách Hàng & Đối Tác</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Họ và tên khách hàng:</span>
                  <span className="font-bold text-base text-slate-900">{order.patientName}</span>
                </div>

                {order.phone && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-xs text-slate-500">Số điện thoại:</span>
                    <span className="font-medium font-mono">{order.phone}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-start gap-1.5">
                    <Building2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-500 block">Nha khoa điều trị:</span>
                      <span className="font-semibold text-slate-900">{order.clinicName}</span>
                      {order.clinicAddress && (
                        <p className="text-xs text-slate-500 mt-0.5">{order.clinicAddress}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Restoration & Warranty */}
              <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quy Cách Phục Hình & Thời Hạn</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Dòng sứ / Vật liệu phục hình:</span>
                  <span className="font-bold text-base text-teal-900">{order.material}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Thời hạn bảo hành:</span>
                    <span className="font-bold text-amber-700 text-sm">
                      {order.warrantyPeriod || `${order.warrantyYears} năm`}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Dáng răng:</span>
                    <span className="font-medium text-slate-800 text-xs sm:text-sm">
                      {order.toothForm}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      Ngày lắp đặt:
                    </div>
                    <span className="font-semibold font-mono text-slate-900 mt-0.5 block">
                      {order.orderDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">Có giá trị đến:</span>
                    <span className="font-semibold font-mono text-emerald-700 mt-0.5 block">
                      {expiryDate}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Teeth positions highlight diagram */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50/90 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Vị trí răng bảo hành:
                </span>
                <span className="text-xs font-bold text-teal-800">
                  {order.teeth} ({order.teethCount} răng)
                </span>
              </div>

              {/* Compact teeth visual mini-chart */}
              <div className="flex flex-col gap-1 items-center justify-center py-1">
                {/* Upper arch */}
                <div className="flex items-center gap-0.5">
                  {[18, 17, 16, 15, 14, 13, 12, 11].map((id) => (
                    <span
                      key={id}
                      className={`w-5 h-6 text-[10px] font-mono font-semibold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-teal-600 text-white border-teal-700 font-bold'
                          : 'bg-white text-slate-300 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                  <span className="w-[1px] h-5 bg-slate-300 mx-0.5" />
                  {[21, 22, 23, 24, 25, 26, 27, 28].map((id) => (
                    <span
                      key={id}
                      className={`w-5 h-6 text-[10px] font-mono font-semibold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-teal-600 text-white border-teal-700 font-bold'
                          : 'bg-white text-slate-300 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                </div>

                {/* Lower arch */}
                <div className="flex items-center gap-0.5">
                  {[48, 47, 46, 45, 44, 43, 42, 41].map((id) => (
                    <span
                      key={id}
                      className={`w-5 h-6 text-[10px] font-mono font-semibold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-teal-600 text-white border-teal-700 font-bold'
                          : 'bg-white text-slate-300 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                  <span className="w-[1px] h-5 bg-slate-300 mx-0.5" />
                  {[31, 32, 33, 34, 35, 36, 37, 38].map((id) => (
                    <span
                      key={id}
                      className={`w-5 h-6 text-[10px] font-mono font-semibold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-teal-600 text-white border-teal-700 font-bold'
                          : 'bg-white text-slate-300 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Terms & Signatures */}
            <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs">
              <div className="space-y-1 text-slate-500 sm:col-span-2">
                <span className="font-semibold text-slate-700 block">Điều kiện bảo hành:</span>
                <p className="leading-relaxed text-[11px]">
                  • Bảo hành trường hợp gãy, vỡ, nứt mẻ tự nhiên của vật liệu sứ trong thời hạn quy định.
                  <br />
                  • Không bảo hành đối với các chấn thương ngoại lực, tai nạn, cắn vật cứng ngoài chức năng nhai hoặc điều trị tủy sau đó làm tổn thương cùi răng.
                </p>
              </div>

              {/* Lab Seal & Signature */}
              <div className="text-center sm:text-right flex flex-col items-center sm:items-end">
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px] mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ĐÃ XÁC THỰC KỸ THUẬT SỐ
                </div>
                <div className="font-semibold text-slate-900">AT DENTAL LAB</div>
                <div className="text-[11px] text-slate-500">Giám Đốc Kỹ Thuật</div>
                <div className="w-24 h-10 border-b border-dashed border-slate-300 mt-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
