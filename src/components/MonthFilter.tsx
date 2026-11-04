import { useLayoutEffect, useState, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown } from 'lucide-react';

export const mobileMonthFilterId = 'mobile-month-filter';

export function MonthFilter({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setHeaderSlot(document.getElementById(mobileMonthFilterId));
  }, []);

  const label = props['aria-label'] || 'Lọc theo tháng';
  const currentMonth = props.value === 'ALL' ? 'Tất cả' : props.value;

  return (
    <>
      <select {...props} aria-label={label} className={className}>{children}</select>
      {headerSlot && createPortal(
        <label className="relative flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <Calendar aria-hidden="true" className="size-3.5 text-blue-600 dark:text-sky-400" />
          <span aria-hidden="true">{currentMonth}</span>
          <ChevronDown aria-hidden="true" className="size-3 text-slate-500" />
          <select {...props} aria-label={label} className="absolute inset-0 size-full cursor-pointer text-base opacity-0">
            {children}
          </select>
        </label>,
        headerSlot
      )}
    </>
  );
}
