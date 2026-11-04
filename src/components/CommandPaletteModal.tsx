import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DentalOrder } from '../types/dental';
import { formatVND } from '../utils/financeUtils';
import {
  Search,
  X,
  ShieldCheck,
  FileDown,
  Printer,
  Building2,
  ArrowRight,
  Command,
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: DentalOrder[];
  onViewWarranty: (order: DentalOrder) => void;
  onPrintTicket: (order: DentalOrder) => void;
  onExportInvoicePdf: (orders: DentalOrder[], clinicName: string, monthYear: string) => void;
  onSelectClinicRevenue: (clinicName: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  orders,
  onViewWarranty,
  onPrintTicket,
  onExportInvoicePdf,
  onSelectClinicRevenue,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return orders.slice(0, 6);
    return orders
      .filter((o) => {
        return (
          o.warrantyCode?.toLowerCase().includes(q) ||
          o.patientName?.toLowerCase().includes(q) ||
          o.clinicName?.toLowerCase().includes(q) ||
          o.phone?.includes(q) ||
          o.material?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [orders, query]);

  const matchedClinics = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    orders.forEach((o) => {
      if (o.clinicName?.toLowerCase().includes(q)) {
        const cur = map.get(o.clinicName) || { name: o.clinicName, count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += o.totalAmount || 0;
        map.set(o.clinicName, cur);
      }
    });
    return Array.from(map.values()).slice(0, 4);
  }, [orders, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-24 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-teal-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nhanh mã thẻ BH (VD: UC11501, NS50205), tên bệnh nhân, SĐT, hoặc nha khoa..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-4">
          {matchedClinics.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Đối Tác Nha Khoa Khớp Từ Khóa
              </div>
              <div className="space-y-1 mt-1">
                {matchedClinics.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {c.count} ca · Tổng doanh thu: {formatVND(c.revenue)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelectClinicRevenue(c.name);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Xem Doanh Thu <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {query.trim() ? `Hồ Sơ Phục Hình Tìm Thấy (${results.length})` : 'Hồ Sơ Phục Hình Gần Đây'}
            </div>
            <div className="space-y-1 mt-1">
              {results.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {order.warrantyCode}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {order.patientName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {order.clinicName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {order.material} · Răng: {order.teeth} ({order.teethCount} răng) ·{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {formatVND(order.totalAmount)}
                      </strong>{' '}
                      · Ngày: {order.orderDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onViewWarranty(order);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Thẻ BH
                    </button>
                    <button
                      onClick={() => {
                        onExportInvoicePdf([order], order.clinicName, order.monthYear);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      HĐ PDF
                    </button>
                    <button
                      onClick={() => {
                        onPrintTicket(order);
                        onClose();
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer"
                      title="In Phiếu Labo"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Nhấn ESC để đóng cửa sổ tìm kiếm nhanh</span>
          <span className="font-mono">AT DENTAL OS · 2026</span>
        </div>
      </div>
    </div>
  );
};
