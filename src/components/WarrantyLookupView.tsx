import React, { useState } from 'react';
import { DentalOrder } from '../types/dental';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface WarrantyLookupViewProps {
  orders: DentalOrder[];
  initialCode?: string;
  onViewFullCertificate: (order: DentalOrder) => void;
}

export const WarrantyLookupView: React.FC<WarrantyLookupViewProps> = ({
  orders,
  initialCode = '',
  onViewFullCertificate,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialCode || 'NS50205');
  const [hasSearched, setHasSearched] = useState(true);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const cleanTerm = searchTerm.trim().toLowerCase();

  const searchResults = React.useMemo(() => {
    if (!cleanTerm) return [];
    return orders.filter((o) => {
      const matchCode =
        o.warrantyCode?.toLowerCase() === cleanTerm ||
        o.warrantyCode?.toLowerCase().includes(cleanTerm);
      const matchPhone = o.phone
        ?.replace(/\D/g, '')
        .includes(cleanTerm.replace(/\D/g, ''));
      const matchPatient = o.patientName?.toLowerCase().includes(cleanTerm);
      return matchCode || matchPhone || matchPatient;
    });
  }, [orders, cleanTerm]);

  const quickSamples = ['ns50205', 'NS50201', 'C296508', 'UC10894', 'RZSBJ5ZD'];

  return (
    <div className="space-y-4">
      {/* Compact Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập Mã thẻ BH (VD: NS50205), Tên KH hoặc SĐT..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shrink-0"
          >
            Tra Cứu
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span>Mã mẫu:</span>
          {quickSamples.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setSearchTerm(sample);
                setHasSearched(true);
              }}
              className="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-slate-50 dark:bg-slate-950 hover:bg-teal-50 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      {hasSearched && (
        <div>
          {searchResults.length === 0 ? (
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-6 text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Không tìm thấy mã &quot;{searchTerm}&quot;
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {searchResults.map((order) => (
                <div
                  key={order.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/60 p-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Chính hãng AT Lab
                        </div>
                        <div className="font-mono text-base font-extrabold text-teal-800 dark:text-teal-300 mt-0.5">
                          {order.warrantyCode}
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
                        {order.warrantyPeriod}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Khách hàng</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {order.patientName}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block">Dòng sứ</span>
                        <span className="font-bold text-teal-700 dark:text-teal-300">
                          {order.material}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block">Nha khoa</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                          {order.clinicName}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block">Ngày lắp</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {order.orderDate}
                        </span>
                      </div>

                      <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Răng phục hình</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {order.teeth} ({order.teethCount} răng)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      onClick={() => onViewFullCertificate(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      In Thẻ BH
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
