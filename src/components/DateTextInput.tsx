import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  addMonths,
  buildCalendarCells,
  formatDdMmYyyy,
  parseDdMmYyyy,
  partsEqual,
  todayParts,
  type DateOnlyParts,
} from '../utils/dateOnly';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export interface DateTextInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  allowClear?: boolean;
  /** Compact density for table cells */
  compact?: boolean;
  autoFocus?: boolean;
  /** Fired when user picks a day from the calendar (not when typing). */
  onSelectDay?: (value: string) => void;
}

function clampPlacement(anchor: DOMRect): { top: number; left: number } {
  const width = 288;
  const height = 340;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = anchor.bottom + 6;
  let left = anchor.left;
  if (top + height > vh - margin) {
    top = Math.max(margin, anchor.top - height - 6);
  }
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
  if (left < margin) left = margin;
  return { top, left };
}

export const DateTextInput: React.FC<DateTextInputProps> = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  disabled,
  readOnly,
  required,
  placeholder = 'DD/MM/YYYY',
  className,
  inputClassName,
  allowClear = false,
  compact = false,
  autoFocus = false,
  onSelectDay,
  ...aria
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const popoverId = `${inputId}-cal`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DateOnlyParts>(() => parseDdMmYyyy(value) || todayParts());
  const [placement, setPlacement] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [focusDay, setFocusDay] = useState<DateOnlyParts | null>(null);

  const selected = parseDdMmYyyy(value);
  const today = todayParts();

  const close = useCallback(() => {
    setOpen(false);
    setFocusDay(null);
  }, []);

  const openCalendar = useCallback(() => {
    if (disabled || readOnly) return;
    const base = parseDdMmYyyy(value) || todayParts();
    setView(base);
    setFocusDay(base);
    setOpen(true);
  }, [disabled, readOnly, value]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    setPlacement(clampPlacement(inputRef.current.getBoundingClientRect()));
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pick = (parts: DateOnlyParts) => {
    const formatted = formatDdMmYyyy(parts);
    onChange(formatted);
    onSelectDay?.(formatted);
    close();
    inputRef.current?.focus();
  };

  const moveFocus = (deltaDays: number) => {
    const base = focusDay || selected || todayParts();
    const next = new Date(base.year, base.month - 1, base.day + deltaDays);
    const parts = { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
    setFocusDay(parts);
    setView(parts);
  };

  const onPopoverKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-7);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(7);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const parts = { year: view.year, month: view.month, day: 1 };
      setFocusDay(parts);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = new Date(view.year, view.month, 0).getDate();
      setFocusDay({ year: view.year, month: view.month, day: last });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (focusDay) pick(focusDay);
    }
  };

  const cells = buildCalendarCells(view.year, view.month);
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(
    new Date(view.year, view.month - 1, 1)
  );

  return (
    <div ref={rootRef} className={`at-date-input ${compact ? 'at-date-input--compact' : ''} ${className || ''}`.trim()}>
      <div className="at-date-input__field">
        <CalendarIcon className="at-date-input__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          placeholder={placeholder}
          value={value}
          aria-label={aria['aria-label']}
          aria-describedby={aria['aria-describedby']}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onClick={() => {
            if (!open) openCalendar();
          }}
          onFocus={() => {
            /* keep manual typing; do not auto-open on every focus to avoid noisy mobile keyboards */
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && (e.altKey || e.metaKey)) {
              e.preventDefault();
              openCalendar();
            }
          }}
          className={`at-date-input__control ${inputClassName || ''}`.trim()}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || readOnly}
          className="at-date-input__toggle"
          aria-label="Mở bảng chọn ngày"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (open) close();
            else openCalendar();
          }}
        >
          <span className="sr-only">Chọn ngày</span>
          <CalendarIcon className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-modal="false"
          aria-label="Chọn ngày"
          className="at-date-popover"
          style={{ top: placement.top, left: placement.left }}
          onMouseDown={(event) => {
            // Keep input focused so blur handlers (inline cell save) do not fire before pick.
            event.preventDefault();
          }}
          onKeyDown={onPopoverKeyDown}
        >
          <div className="at-date-popover__header">
            <button
              type="button"
              className="at-date-popover__nav"
              aria-label="Tháng trước"
              onClick={() => setView((v) => addMonths({ ...v, day: 1 }, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="at-date-popover__title">{monthLabel}</div>
            <button
              type="button"
              className="at-date-popover__nav"
              aria-label="Tháng sau"
              onClick={() => setView((v) => addMonths({ ...v, day: 1 }, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="at-date-popover__weekdays" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="at-date-popover__grid" role="grid" aria-label={monthLabel}>
            {cells.map((cell, index) => {
              if (!cell) {
                return <span key={`e-${index}`} className="at-date-popover__cell at-date-popover__cell--empty" />;
              }
              const isSelected = partsEqual(cell, selected);
              const isToday = partsEqual(cell, today);
              const isFocused = partsEqual(cell, focusDay);
              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}`}
                  type="button"
                  role="gridcell"
                  tabIndex={isFocused || (!focusDay && isSelected) || (!focusDay && !selected && isToday) ? 0 : -1}
                  aria-selected={isSelected}
                  className={[
                    'at-date-popover__cell',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    isFocused ? 'is-focused' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pick(cell)}
                  onFocus={() => setFocusDay(cell)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="at-date-popover__footer">
            <button
              type="button"
              className="at-date-popover__link"
              onClick={() => pick(todayParts())}
            >
              Hôm nay
            </button>
            {allowClear && (
              <button
                type="button"
                className="at-date-popover__link"
                onClick={() => {
                  onChange('');
                  close();
                  inputRef.current?.focus();
                }}
              >
                Xóa
              </button>
            )}
            <button type="button" className="at-date-popover__link at-date-popover__link--muted" onClick={close}>
              <X className="w-3.5 h-3.5 inline-block mr-1" aria-hidden="true" />
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTextInput;

/** Inline table-cell editor: typing commits on blur/Enter; calendar pick commits immediately. */
export function DateCellEditor(props: {
  initialValue: string;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onCommit: (value: string, leaving: boolean) => void;
  onCancel: () => void;
  onDraftChange?: () => void;
}) {
  const [draft, setDraft] = React.useState(props.initialValue);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  return (
    <div
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          props.onCommit(draftRef.current, false);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          props.onCancel();
        }
      }}
    >
      <DateTextInput
        compact
        autoFocus
        aria-label={props.label}
        aria-describedby={props.describedBy}
        value={draft}
        disabled={props.disabled}
        inputClassName={`box-border h-7 w-full min-w-0 max-w-full rounded border ${
          props.invalid ? 'border-rose-500' : 'border-teal-500'
        } bg-white px-1.5 py-0 text-slate-900 leading-none focus:ring-2 focus:ring-teal-500/40 dark:bg-slate-900 dark:text-white`}
        onChange={(next) => {
          setDraft(next);
          props.onDraftChange?.();
        }}
        onSelectDay={(next) => {
          setDraft(next);
          props.onCommit(next, false);
        }}
        onBlur={() => props.onCommit(draftRef.current, true)}
      />
    </div>
  );
}
