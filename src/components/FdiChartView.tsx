import React, { useState } from 'react';
import { DentalOrder } from '../types/dental';
import { FdiTeethPicker } from './FdiTeethPicker';
import { ALL_ADULT_TEETH } from '../utils/fdiTeeth';
import { Plus } from 'lucide-react';

interface FdiChartViewProps {
  orders: DentalOrder[];
  readOnly?: boolean;
  onStartOrderWithTeeth: (teethText: string) => void;
}

export const FdiChartView: React.FC<FdiChartViewProps> = ({
  orders,
  readOnly = false,
  onStartOrderWithTeeth,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([11, 21]);
  const [teethString, setTeethString] = useState('11, 21');

  const handleTeethChange = (ids: number[], formatted: string) => {
    setSelectedIds(ids);
    setTeethString(formatted);
  };

  const matchingOrders = orders
    .filter((o) => {
      if (!o.teeth || selectedIds.length === 0) return false;
      return selectedIds.some(
        (id) =>
          o.teeth.includes(id.toString()) ||
          o.teeth.toLowerCase().includes('toàn hàm')
      );
    })
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-8 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Sơ Đồ Răng FDI (ISO 3950)
          </h3>

          {!readOnly && (
            <button
              onClick={() => onStartOrderWithTeeth(teethString)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo Đơn ({selectedIds.length} răng)
            </button>
          )}
        </div>

        <FdiTeethPicker selectedIds={selectedIds} onChange={handleTeethChange} />
      </div>

      <div className="xl:col-span-4 space-y-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
            Răng Đang Chọn ({selectedIds.length})
          </h3>

          {selectedIds.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Chưa chọn răng</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {selectedIds.map((id) => {
                const info = ALL_ADULT_TEETH.find((t) => t.id === id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-teal-600 text-white font-mono font-bold flex items-center justify-center text-[11px]">
                        {id}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {info?.nameVi || `Răng ${id}`}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {info?.arch === 'upper' ? 'Hàm trên' : 'Hàm dưới'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
            Ca Liên Quan ({matchingOrders.length})
          </h3>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {matchingOrders.map((o) => (
              <div
                key={o.id}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                    {o.warrantyCode}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {o.patientName}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                  <span className="truncate max-w-[140px]">{o.clinicName}</span>
                  <span className="font-mono">{o.material}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
