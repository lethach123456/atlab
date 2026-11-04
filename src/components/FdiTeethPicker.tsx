import React from 'react';
import {
  ALL_ADULT_TEETH,
  QUADRANT_1,
  QUADRANT_2,
  QUADRANT_3,
  QUADRANT_4,
  UPPER_TEETH,
  LOWER_TEETH,
  formatTeethList,
} from '../utils/fdiTeeth';

interface FdiTeethPickerProps {
  selectedIds: number[];
  onChange: (ids: number[], formattedString: string) => void;
  compact?: boolean;
}

export const FdiTeethPicker: React.FC<FdiTeethPickerProps> = ({
  selectedIds,
  onChange,
  compact = false,
}) => {
  const toggleTooth = (id: number) => {
    let next: number[];
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((t) => t !== id);
    } else {
      next = [...selectedIds, id].sort((a, b) => a - b);
    }
    onChange(next, formatTeethList(next));
  };

  const selectGroup = (teeth: number[]) => {
    const allSelected = teeth.every((t) => selectedIds.includes(t));
    let next: number[];
    if (allSelected) {
      // Deselect these
      next = selectedIds.filter((t) => !teeth.includes(t));
    } else {
      // Add missing
      next = Array.from(new Set([...selectedIds, ...teeth])).sort((a, b) => a - b);
    }
    onChange(next, formatTeethList(next));
  };

  const selectFullMouth = () => {
    // 28 non-wisdom teeth
    const nonWisdom = ALL_ADULT_TEETH.filter((t) => t.index !== 8).map((t) => t.id);
    const isFullAlready = nonWisdom.every((t) => selectedIds.includes(t));
    if (isFullAlready) {
      onChange([], '');
    } else {
      onChange(nonWisdom, 'Toàn hàm');
    }
  };

  const selectAestheticZone = () => {
    // 13 -> 23 & 33 -> 43
    const aesthetic = [13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33];
    selectGroup(aesthetic);
  };

  const clearAll = () => {
    onChange([], '');
  };

  const renderToothButton = (id: number) => {
    const isSelected = selectedIds.includes(id);
    const toothInfo = ALL_ADULT_TEETH.find((t) => t.id === id);
    const isMolar = toothInfo && (toothInfo.index === 6 || toothInfo.index === 7 || toothInfo.index === 8);
    const isPremolar = toothInfo && (toothInfo.index === 4 || toothInfo.index === 5);
    const isCanine = toothInfo?.index === 3;

    return (
      <button
        key={id}
        type="button"
        onClick={() => toggleTooth(id)}
        title={toothInfo?.nameVi || `Răng ${id}`}
        className={`relative flex flex-col items-center justify-center transition-all ${
          compact ? 'w-7 h-9 text-[10px]' : 'w-8 sm:w-9 h-11 sm:h-12 text-xs'
        } rounded-md font-semibold border ${
          isSelected
            ? 'bg-teal-600 text-white border-teal-700 shadow-sm scale-105 z-10 ring-2 ring-teal-300 ring-offset-1'
            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50'
        }`}
      >
        {/* Anatomical crown shape accent */}
        <span
          className={`w-3 h-2 rounded-t-sm mb-0.5 transition-colors ${
            isSelected
              ? 'bg-teal-200'
              : isMolar
              ? 'bg-slate-300'
              : isPremolar
              ? 'bg-slate-200'
              : isCanine
              ? 'bg-amber-100 border border-amber-300'
              : 'bg-slate-100'
          }`}
        />
        <span>{id}</span>
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
      {/* Top quick-select actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sơ đồ răng FDI quốc tế:
          </span>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {selectedIds.length} răng đã chọn
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={selectFullMouth}
            className="px-2.5 py-1 font-medium bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 rounded-md transition-colors shadow-2xs"
          >
            Toàn hàm (28 răng)
          </button>
          <button
            type="button"
            onClick={() => selectGroup(UPPER_TEETH)}
            className="px-2.5 py-1 font-medium bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 rounded-md transition-colors shadow-2xs"
          >
            Hàm trên
          </button>
          <button
            type="button"
            onClick={() => selectGroup(LOWER_TEETH)}
            className="px-2.5 py-1 font-medium bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 rounded-md transition-colors shadow-2xs"
          >
            Hàm dưới
          </button>
          <button
            type="button"
            onClick={selectAestheticZone}
            className="px-2.5 py-1 font-medium bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 rounded-md transition-colors shadow-2xs"
          >
            Vùng thẩm mỹ (13-23, 33-43)
          </button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="px-2 py-1 font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            >
              Xóa chọn
            </button>
          )}
        </div>
      </div>

      {/* Dental arch layout: Upper Arch */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 px-1 mb-1">
            <span>Phải (R)</span>
            <span className="font-semibold text-slate-600 uppercase tracking-wide">Cung Hàm Trên (Upper)</span>
            <span>Trái (L)</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1 [justify-content:safe_center] sm:gap-1.5">
            {/* Q1: 18 -> 11 */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {QUADRANT_1.map((id) => renderToothButton(id))}
            </div>

            {/* Midline divider */}
            <div className="w-[2px] h-10 bg-teal-400/60 rounded-full mx-1" title="Đường giữa hàm (Midline)" />

            {/* Q2: 21 -> 28 */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {QUADRANT_2.map((id) => renderToothButton(id))}
            </div>
          </div>
        </div>

        {/* Horizontal midline separator */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-dashed border-slate-300" />
          <span className="absolute bg-slate-100 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Đường cắn khớp
          </span>
        </div>

        {/* Lower Arch */}
        <div>
          <div className="flex items-center gap-1 overflow-x-auto py-1 [justify-content:safe_center] sm:gap-1.5">
            {/* Q4: 48 -> 41 */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {QUADRANT_4.map((id) => renderToothButton(id))}
            </div>

            {/* Midline divider */}
            <div className="w-[2px] h-10 bg-teal-400/60 rounded-full mx-1" title="Đường giữa hàm (Midline)" />

            {/* Q3: 31 -> 38 */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {QUADRANT_3.map((id) => renderToothButton(id))}
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 px-1 mt-1">
            <span>Phải (R)</span>
            <span className="font-semibold text-slate-600 uppercase tracking-wide">Cung Hàm Dưới (Lower)</span>
            <span>Trái (L)</span>
          </div>
        </div>
      </div>

      {/* Selected teeth readable preview */}
      <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
        <span className="text-slate-500">Chỉ định phục hình:</span>
        <span className="font-mono font-medium text-slate-800 text-right truncate max-w-[280px] sm:max-w-md">
          {formatTeethList(selectedIds)}
        </span>
      </div>
    </div>
  );
};
