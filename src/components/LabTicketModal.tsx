import React from 'react';
import { DentalOrder } from '../types/dental';
import { parseTeethNotation } from '../utils/fdiTeeth';
import { X, Printer, Wrench, CheckSquare, Sparkles } from 'lucide-react';

interface LabTicketModalProps {
  order: DentalOrder | null;
  onClose: () => void;
}

export const LabTicketModal: React.FC<LabTicketModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const teethInfo = parseTeethNotation(order.teeth);
  const activeTeeth = new Set(teethInfo.toothIds);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm tracking-wide">
              PHIẾU LỆNH SẢN XUẤT LABO & CHẾ TÁC PHỤC HÌNH
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              In Phiếu Labo
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE LAB TICKET CANVAS */}
        <div className="p-6 sm:p-8 bg-white print:p-6 print:m-0">
          <div className="border-2 border-slate-900 rounded-lg p-5">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-base">
                  AT
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">AT DENTAL LAB</h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Trung tâm răng sứ chất lượng cao · Hotline: 0903.589.987
                  </p>
                  <div className="mt-0.5 text-xs font-bold text-blue-700">
                    PHIẾU CHẾ TÁC PHỤC HÌNH SỨ CAO CẤP
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-black text-slate-900 px-3 py-1 bg-slate-100 border border-slate-300 rounded inline-block">
                  {order.warrantyCode}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Ngày nhận: <span className="font-semibold text-slate-700">{order.orderDate}</span>
                </div>
              </div>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200">
              <div>
                <span className="text-slate-500 block">Nha khoa / Bác sĩ:</span>
                <span className="font-bold text-sm text-slate-900">{order.clinicName}</span>
                <p className="text-slate-500 text-[11px] mt-0.5">{order.clinicAddress}</p>
              </div>

              <div>
                <span className="text-slate-500 block">Bệnh nhân:</span>
                <span className="font-bold text-sm text-slate-900">{order.patientName}</span>
                <p className="text-slate-500 text-[11px] mt-0.5 font-mono">{order.phone || '—'}</p>
              </div>

              <div>
                <span className="text-slate-500 block">Vật liệu sứ:</span>
                <span className="font-bold text-teal-900 text-sm">{order.material}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Dáng răng & Bảo hành:</span>
                <span className="font-semibold text-slate-800">
                  {[order.toothForm, order.warrantyPeriod].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>

            {/* Teeth Position Chart */}
            <div className="py-4 border-b border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Sơ đồ vị trí răng phục hình:
                </span>
                <span className="text-xs font-mono font-bold text-teal-800">
                  {order.teeth} ({order.teethCount} răng)
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  {[18, 17, 16, 15, 14, 13, 12, 11].map((id) => (
                    <span
                      key={id}
                      className={`w-6 h-7 text-xs font-mono font-bold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                  <span className="w-0.5 h-6 bg-slate-300 mx-1" />
                  {[21, 22, 23, 24, 25, 26, 27, 28].map((id) => (
                    <span
                      key={id}
                      className={`w-6 h-7 text-xs font-mono font-bold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  {[48, 47, 46, 45, 44, 43, 42, 41].map((id) => (
                    <span
                      key={id}
                      className={`w-6 h-7 text-xs font-mono font-bold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                  <span className="w-0.5 h-6 bg-slate-300 mx-1" />
                  {[31, 32, 33, 34, 35, 36, 37, 38].map((id) => (
                    <span
                      key={id}
                      className={`w-6 h-7 text-xs font-mono font-bold flex items-center justify-center rounded-xs border ${
                        activeTeeth.has(id) || teethInfo.isFullArch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {id % 10}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Production Workflow Checklist */}
            <div className="py-4 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                Quy Trình Kiểm Soát Kỹ Thuật (KCS):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>1. Đổ mẫu & Scan CAD</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>2. Thiết kế đường hoàn tất</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>3. Phay CAM & Sintering</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>4. Đắp sứ & Rìa cắn</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>5. Nướng bóng Glaze</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>6. Test khớp & KCS giao</span>
                </label>
              </div>
            </div>

            {/* Notes & Signatures */}
            <div className="pt-4 grid grid-cols-2 gap-4 items-end text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Ghi chú kỹ thuật viên:</span>
                <div className="min-h-[50px] p-2 bg-slate-50 rounded border border-slate-200 text-slate-700">
                  {order.notes || 'Thực hiện theo đúng phôi và khớp cắn chỉ định.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <span className="text-slate-500 text-[11px] block">Kỹ thuật viên</span>
                  <div className="h-12 border-b border-dashed border-slate-300 mt-1" />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Trưởng xưởng KCS</span>
                  <div className="h-12 border-b border-dashed border-slate-300 mt-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
