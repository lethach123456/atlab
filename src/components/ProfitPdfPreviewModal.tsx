import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import type { LabProfileConfig } from '../types/dental';
import type { MonthlyProfitReport } from '../utils/profit';

interface ProfitPdfPreviewModalProps {
  monthYear: string;
  report: MonthlyProfitReport;
  labProfile: LabProfileConfig;
  onClose: () => void;
}

/** Previews the exact PDF snapshot that will be downloaded. */
export function ProfitPdfPreviewModal({ monthYear, report, labProfile, onClose }: ProfitPdfPreviewModalProps) {
  const snapshot = useRef({ monthYear, report, labProfile });
  const closeRef = useRef(onClose);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<jsPDF | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  closeRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])'
        ));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    void (async () => {
      try {
        const { createProfitReportPdf } = await import('../utils/profitPdfExporter');
        const pdf = await createProfitReportPdf(snapshot.current);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(pdf.output('blob'));
        pdfRef.current = pdf;
        setUrl(objectUrl);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không tạo được báo cáo PDF. Vui lòng thử lại.');
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKeyDown);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      pdfRef.current = null;
      previousFocus?.focus();
    };
  }, []);

  function download() {
    if (!pdfRef.current) return;
    setDownloadError('');
    try {
      const safePeriod = snapshot.current.monthYear.replace(/[^0-9]/g, '-');
      pdfRef.current.save(`Bao-Cao-Loi-Nhuan-${safePeriod}.pdf`);
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Không tải được báo cáo PDF. Vui lòng thử lại.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-xs sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profit-pdf-preview-title"
        className="flex h-[min(94dvh,60rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-3 py-3 text-white sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText aria-hidden="true" className="size-5 shrink-0 text-blue-300" />
            <div>
              <h2 id="profit-pdf-preview-title" className="text-sm font-bold">Xem trước báo cáo lợi nhuận</h2>
              <p className="text-xs text-slate-300">Tháng {snapshot.current.monthYear}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Mở báo cáo trong cửa sổ mới"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
              <ExternalLink aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Mở rộng</span>
            </a>}
            <button type="button" onClick={download} disabled={!url}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-50">
              <Download aria-hidden="true" className="size-4" /> Tải PDF
            </button>
            <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Đóng xem trước"
              className="inline-flex size-11 items-center justify-center rounded-xl text-slate-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
        {downloadError && <p role="alert" className="bg-rose-50 px-4 py-2 text-sm text-rose-800">{downloadError}</p>}
        <div className="relative min-h-0 flex-1 bg-slate-100 dark:bg-slate-800">
          {url ? (
            <iframe title="Xem trước các trang báo cáo lợi nhuận" src={url} className="size-full border-0" />
          ) : error ? (
            <p role="alert" className="p-5 text-sm text-rose-700 dark:text-rose-300">{error}</p>
          ) : (
            <div role="status" className="flex h-full items-center justify-center gap-2 p-5 text-sm text-slate-600 dark:text-slate-200">
              <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> Đang tạo bản xem trước…
            </div>
          )}
        </div>
        {url && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Nếu trình duyệt chưa hiển thị đầy đủ, dùng nút Mở rộng để xem tất cả các trang.
        </p>}
      </div>
    </div>
  );
}
