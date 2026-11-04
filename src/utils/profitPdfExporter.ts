import { jsPDF } from 'jspdf';
import type { LabProfileConfig } from '../types/dental';
import type { MonthlyProfitReport } from './profit';
import { DEFAULT_LAB_PROFILE, formatVND } from './financeUtils';

export interface ExportProfitReportPdfOptions {
  monthYear: string;
  report: MonthlyProfitReport;
  labProfile: LabProfileConfig;
}

interface ReportColumn {
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

interface ReportRow {
  cells: string[];
  strong?: boolean;
}

interface ReportTable {
  title?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  total?: { label: string; value: string };
}

export interface ProfitPdfSection {
  title: string;
  notes: string[];
  tables: ReportTable[];
}

const WIDTH = 1123;
const HEIGHT = 794;
const MARGIN = 38;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = HEIGHT - 42;
const SCALE = 2;
const FONT = "'Be Vietnam Pro', Arial, sans-serif";
const TEXT_SIZE = 10;
const LINE_HEIGHT = 14;
const CELL_PADDING = 7;
const colors = {
  ink: '#0f172a', muted: '#475569', blue: '#1e3a8a', border: '#cbd5e1',
  header: '#eaf0fa', alternate: '#f8fafc', white: '#ffffff', total: '#e2e8f0',
};
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 });
const amount = (value: number) => formatVND(value);
const present = (value: string | undefined) => value?.trim() || '-';
const compact = (...values: (string | undefined)[]) => values.filter((value) => value?.trim()).join('\n') || '-';
const cashMethod = (method: string) => method === 'cash' ? 'Tiền mặt' : method === 'transfer' ? 'Chuyển khoản' : '-';

/** The complete data set is built independently from the currently visible tab. */
export function buildProfitPdfSections(report: MonthlyProfitReport): ProfitPdfSection[] {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const fixedCostNotes: string[] = [];
  if (report.rentInCashflow !== report.rentExpense) {
    fixedCostNotes.push(`Mặt bằng dùng số đã chỉnh ${amount(report.rentExpense)} (phiếu chi ${amount(report.rentInCashflow)}).`);
  }
  if (report.utilitiesInCashflow !== report.utilitiesExpense) {
    fixedCostNotes.push(`Điện nước dùng số đã chỉnh ${amount(report.utilitiesExpense)} (phiếu chi ${amount(report.utilitiesInCashflow)}).`);
  }
  const summaryRows: [string, number, boolean?][] = [
    ['Tổng doanh thu', report.grossRevenue],
    ['Tổng chiết khấu', -report.discounts],
    ['Doanh thu sau chiết khấu', report.netRevenue, true],
    ['Tổng lương', report.payrollExpense],
    ['Tổng chi từ bảng chi', report.operatingExpenses],
    ['Chi phí mặt bằng', report.rentExpense],
    ['Điện nước', report.utilitiesExpense],
    ['Tổng giao vận', report.deliveryExpense],
    ['Chi phí khác', report.extraExpense],
    ['Tổng chi phí', report.expenses, true],
    ['LỢI NHUẬN', report.profit, true],
  ];
  return [
    {
      title: '1. BẢNG LỢI NHUẬN',
      notes: [
        'Lợi nhuận = Doanh thu - Chiết khấu - Tổng chi phí. Các bảng bên dưới trình bày toàn bộ dữ liệu trong kỳ.',
        'Lương và giao vận dùng số lớn hơn giữa bảng nghiệp vụ và phiếu chi cùng nhóm để tránh cộng hai lần. Nha khoa trả phí giao vận được tách riêng.',
        ...fixedCostNotes,
      ],
      tables: [
        {
          columns: [{ label: 'Khoản mục', width: 747 }, { label: 'Số tiền (đ)', width: 300, align: 'right' }],
          rows: [
            ...summaryRows.map(([label, value, strong]) => ({ cells: [label, amount(value)], strong })),
            { cells: ['Biên lợi nhuận', report.margin === null ? '-' : percent.format(report.margin)], strong: true },
          ],
        },
        {
          title: 'Chi tiết chi phí khác',
          columns: [
            { label: 'STT', width: 36, align: 'center' }, { label: 'Nội dung', width: 421 },
            { label: 'Ngày', width: 95 }, { label: 'Ghi chú', width: 300 },
            { label: 'Số tiền (đ)', width: 195, align: 'right' },
          ],
          rows: report.extraRows.map((row, index) => ({ cells: [String(index + 1), row.title, present(row.date), present(row.notes), amount(row.amount)] })),
          total: { label: 'Tổng chi phí khác', value: amount(report.extraExpense) },
        },
      ],
    },
    {
      title: '2. BẢNG LƯƠNG TỔNG HỢP',
      notes: [
        `Tổng thực lĩnh ${amount(report.savedPayroll)}. Phiếu chi lương ${amount(report.payrollInCashflow)}. Chi phí lương tính vào lợi nhuận ${amount(report.payrollExpense)}.`,
        'Lương dùng cùng công thức với mục Bảng lương, bao gồm hoa hồng sale và nhân sự tự thêm trong kỳ.',
      ],
      tables: [{
        columns: [
          { label: 'STT', width: 36, align: 'center' }, { label: 'Nhân sự / Liên hệ', width: 150 },
          { label: 'Ngày công', width: 43, align: 'center' }, { label: 'Lương cơ bản (đ)', width: 86, align: 'right' },
          { label: 'Phụ cấp (đ)', width: 81, align: 'right' }, { label: 'Hoa hồng (đ)', width: 87, align: 'right' },
          { label: 'Thưởng (đ)', width: 79, align: 'right' }, { label: 'Khấu trừ (đ)', width: 79, align: 'right' },
          { label: 'Thực lĩnh (đ)', width: 96, align: 'right' }, { label: 'Thanh toán', width: 101 },
          { label: 'Ghi chú', width: 109 },
        ],
        rows: report.payrollRows.map((row, index) => ({ cells: [
          String(index + 1), compact(row.employeeName, row.position, row.phone, row.employeeEmail),
          String(row.workDays), amount(row.baseSalary), amount(row.allowance), amount(row.commissionAmount),
          amount(row.bonus), amount(row.deduction), amount(row.netSalary),
          compact(row.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán', row.paymentDate), present(row.notes),
        ] })),
        total: { label: 'Tổng thực lĩnh', value: amount(report.savedPayroll) },
      }],
    },
    {
      title: '3. BẢNG CHI',
      notes: [
        `Tổng phiếu chi ${amount(sum(report.expenseRows.map((row) => row.amount)))}. Phần đưa vào dòng Tổng chi từ bảng chi ${amount(report.operatingExpenses)}.`,
        'Lương, giao vận, mặt bằng, điện nước và chi phí nhập thêm được tính ở các dòng riêng trong bảng lợi nhuận.',
      ],
      tables: [{
        columns: [
          { label: 'STT', width: 30, align: 'center' }, { label: 'Nội dung', width: 198 },
          { label: 'Danh mục', width: 135 }, { label: 'Ngày', width: 75 },
          { label: 'Nha khoa', width: 125 }, { label: 'Hình thức', width: 92 },
          { label: 'Số tiền (đ)', width: 105, align: 'right' }, { label: 'Ghi chú', width: 287 },
        ],
        rows: report.expenseRows.map((row, index) => ({ cells: [
          String(index + 1), row.title, present(row.category), present(row.date), present(row.clinicName),
          cashMethod(row.paymentMethod), amount(row.amount), present(row.notes),
        ] })),
        total: { label: 'Tổng phiếu chi', value: amount(sum(report.expenseRows.map((row) => row.amount))) },
      }],
    },
    {
      title: '4. BẢNG CHIẾT KHẤU',
      notes: ['Chiết khấu theo từng nha khoa trong kỳ, gồm số đã chốt ở bảng công nợ và tỷ lệ áp dụng cho doanh số.'],
      tables: [{
        columns: [
          { label: 'STT', width: 36, align: 'center' }, { label: 'Nha khoa', width: 406 },
          { label: 'Doanh số (đ)', width: 220, align: 'right' }, { label: 'Tỷ lệ thực tế', width: 170, align: 'right' },
          { label: 'Chiết khấu (đ)', width: 215, align: 'right' },
        ],
        rows: report.salesRows.filter((row) => row.discountAmount > 0).map((row, index) => ({ cells: [
          String(index + 1), row.clinicName, amount(row.grossRevenue),
          row.grossRevenue > 0 ? percent.format(row.discountAmount / row.grossRevenue) : '-', amount(row.discountAmount),
        ] })),
        total: { label: 'Tổng chiết khấu', value: amount(report.discounts) },
      }],
    },
    {
      title: '5. DOANH SỐ THEO NHA KHOA',
      notes: [
        `Doanh số ${amount(report.grossRevenue)} - Chiết khấu ${amount(report.discounts)} = Doanh thu sau chiết khấu ${amount(report.netRevenue)}.`,
        'Số ca và số răng theo đơn hàng trong kỳ. Doanh số kỳ gốc sử dụng số đã chốt nếu có bảng công nợ gốc.',
      ],
      tables: [{
        columns: [
          { label: 'STT', width: 30, align: 'center' }, { label: 'Nha khoa', width: 327 },
          { label: 'Số ca', width: 70, align: 'right' }, { label: 'Số răng', width: 70, align: 'right' },
          { label: 'Doanh số (đ)', width: 185, align: 'right' }, { label: 'Chiết khấu (đ)', width: 180, align: 'right' },
          { label: 'Sau chiết khấu (đ)', width: 185, align: 'right' },
        ],
        rows: report.salesRows.map((row, index) => ({ cells: [
          String(index + 1), row.clinicName, String(row.orderCount), String(row.teethCount),
          amount(row.grossRevenue), amount(row.discountAmount), amount(row.netRevenue),
        ] })),
        total: { label: 'Tổng doanh thu sau chiết khấu', value: amount(report.netRevenue) },
      }],
    },
    {
      title: '6. BẢNG GIAO VẬN',
      notes: [
        `Labo trả ${amount(report.labDelivery)} (gồm ${amount(report.assumedLabDelivery)} chưa ghi bên trả). Nha khoa trả ${amount(report.clinicDelivery)}. Tổng toàn bộ giao vận ${amount(report.labDelivery + report.clinicDelivery)}.`,
        `Phiếu chi giao vận ${amount(report.deliveryInCashflow)}. Chi phí giao vận tính vào lợi nhuận ${amount(report.deliveryExpense)}. Bên trả để trống được tính cho labo.`,
      ],
      tables: [{
        columns: [
          { label: 'STT', width: 36, align: 'center' }, { label: 'Ngày / Mã BH', width: 100 },
          { label: 'Nha khoa / Khách hàng', width: 160 }, { label: 'Giao nhận / Địa chỉ', width: 180 },
          { label: 'Loại / Trạng thái', width: 100 }, { label: 'Bên trả', width: 100 },
          { label: 'Phí (đ)', width: 105, align: 'right' }, { label: 'Ghi chú', width: 176 },
          { label: 'Mã vận đơn', width: 90 },
        ],
        rows: report.deliveryRows.map((row, index) => ({ cells: [
          String(index + 1), compact(row.deliveryDate, row.warrantyCode), compact(row.clinicName, row.patientName),
          compact(row.courierName, row.clinicAddress),
          compact(({ pickup: 'Nhận mẫu', delivery: 'Giao răng', both: 'Khứ hồi', '': '-' } as const)[row.direction],
            ({ pending: 'Chờ giao', shipping: 'Đang giao', delivered: 'Đã giao', returned: 'Hoàn trả', '': '-' } as const)[row.status]),
          row.payer === 'clinic' ? 'Nha khoa' : row.payer === 'lab' ? 'Labo' : 'Labo (mặc định)',
          amount(row.shippingFee), present(row.notes), present(row.trackingCode),
        ] })),
        total: { label: 'Tổng giao vận tính vào lợi nhuận', value: amount(report.deliveryExpense) },
      }],
    },
  ];
}

type TextCommand = { kind: 'text'; text: string; x: number; y: number; size: number; color: string; bold?: boolean; align?: CanvasTextAlign };
type DrawCommand = TextCommand |
  { kind: 'rect'; x: number; y: number; width: number; height: number; color: string } |
  { kind: 'line'; x: number; y: number; x2: number; y2: number; color: string };
interface ReportPage { commands: DrawCommand[] }

function setFont(ctx: CanvasRenderingContext2D, size = TEXT_SIZE, bold = false) {
  ctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
}

function wrapText(ctx: CanvasRenderingContext2D, input: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(input || '-').split(/\r?\n/)) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width <= width) { line += ` ${word}`; continue; }
      if (line) { lines.push(line); line = ''; }
      if (ctx.measureText(word).width <= width) { line = word; continue; }
      for (const letter of Array.from(word)) {
        if (line && ctx.measureText(line + letter).width > width) { lines.push(line); line = ''; }
        line += letter;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : ['-'];
}

function layoutReport(ctx: CanvasRenderingContext2D, sections: ProfitPdfSection[], options: ExportProfitReportPdfOptions) {
  const pages: ReportPage[] = [];
  let page: ReportPage;
  let y = 0;
  let currentSection: ProfitPdfSection;
  const created = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const profile = { ...DEFAULT_LAB_PROFILE, ...Object.fromEntries(Object.entries(options.labProfile).filter(([, value]) => value?.trim())) };
  const text = (value: string, x: number, top: number, size = TEXT_SIZE, bold = false, color = colors.ink, align: CanvasTextAlign = 'left') => {
    page.commands.push({ kind: 'text', text: value, x, y: top, size, bold, color, align });
  };
  const rect = (x: number, top: number, width: number, height: number, color: string) => {
    page.commands.push({ kind: 'rect', x, y: top, width, height, color });
  };
  const line = (x: number, top: number, x2: number, y2: number, color = colors.border) => {
    page.commands.push({ kind: 'line', x, y: top, x2, y2, color });
  };
  function paragraph(value: string, size = TEXT_SIZE, bold = false, color = colors.muted) {
    setFont(ctx, size, bold);
    const lines = wrapText(ctx, value, CONTENT_WIDTH);
    for (const item of lines) { text(item, MARGIN, y, size, bold, color); y += LINE_HEIGHT; }
  }
  function newPage(continued = false) {
    page = { commands: [] };
    pages.push(page);
    if (pages.length === 1) {
      text('BÁO CÁO LỢI NHUẬN', MARGIN, 30, 20, true, colors.blue);
      text(`Kỳ ${options.monthYear}`, WIDTH - MARGIN, 33, 13, true, colors.ink, 'right');
      y = 61;
      setFont(ctx, 12, true);
      const labLines = wrapText(ctx, profile.labName, CONTENT_WIDTH - 255);
      labLines.forEach((item, index) => text(item, MARGIN, y + index * 16, 12, true));
      text(`Ngày xuất ${created}`, WIDTH - MARGIN, y + 1, 9, false, colors.muted, 'right');
      y += labLines.length * 16 + 3;
      paragraph(compact(profile.address ? `Địa chỉ ${profile.address}` : '', profile.hotline ? `Hotline ${profile.hotline}` : ''), 9.5);
      line(MARGIN, y + 1, WIDTH - MARGIN, y + 1);
      y += 16;
    } else {
      y = 35;
    }
    text(`${currentSection.title}${continued ? ' (tiếp)' : ''}`, MARGIN, y, 13, true, colors.blue);
    y += 22;
    if (!continued) {
      currentSection.notes.forEach((note) => paragraph(note, 9.5));
      if (currentSection.notes.length) y += 7;
    }
  }
  function tableHeader(table: ReportTable, continued = false) {
    if (table.title) {
      text(`${table.title}${continued ? ' (tiếp)' : ''}`, MARGIN, y, 11, true);
      y += 20;
    }
    setFont(ctx, TEXT_SIZE, true);
    const labels = table.columns.map((column) => wrapText(ctx, column.label, column.width - CELL_PADDING * 2));
    const height = Math.max(...labels.map((rows) => rows.length)) * LINE_HEIGHT + CELL_PADDING * 2;
    rect(MARGIN, y, CONTENT_WIDTH, height, colors.header);
    let x = MARGIN;
    table.columns.forEach((column, index) => {
      labels[index].forEach((label, row) => {
        const align = column.align || 'left';
        const left = align === 'right' ? x + column.width - CELL_PADDING : align === 'center' ? x + column.width / 2 : x + CELL_PADDING;
        text(label, left, y + CELL_PADDING + row * LINE_HEIGHT, TEXT_SIZE, true, colors.blue, align);
      });
      x += column.width;
    });
    y += height;
    line(MARGIN, y, WIDTH - MARGIN, y);
  }
  function drawTable(table: ReportTable) {
    // Reserve enough room for the title, headings and at least one content line.
    setFont(ctx, TEXT_SIZE, true);
    const headerLines = Math.max(...table.columns.map((column) => wrapText(ctx, column.label, column.width - CELL_PADDING * 2).length));
    const headerHeight = headerLines * LINE_HEIGHT + CELL_PADDING * 2 + (table.title ? 20 : 0);
    if (y + headerHeight + LINE_HEIGHT + CELL_PADDING * 2 > CONTENT_BOTTOM) newPage(true);
    tableHeader(table);
    if (!table.rows.length) {
      rect(MARGIN, y, CONTENT_WIDTH, 32, colors.white);
      text('Chưa có dữ liệu trong kỳ.', MARGIN + CELL_PADDING, y + 9, TEXT_SIZE, false, colors.muted);
      y += 32;
      line(MARGIN, y, WIDTH - MARGIN, y);
    }
    const rows = table.rows;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      setFont(ctx, TEXT_SIZE, row.strong);
      const cells = table.columns.map((column, cell) => row.cells[cell] === '' ? [''] : wrapText(ctx, row.cells[cell] || '-', column.width - CELL_PADDING * 2));
      const lineCount = Math.max(...cells.map((cell) => cell.length));
      let offset = 0;
      while (offset < lineCount) {
        const remaining = Math.floor((CONTENT_BOTTOM - y - CELL_PADDING * 2) / LINE_HEIGHT);
        // Keep ordinary rows together; split an exceptionally long row across pages.
        if (remaining < 1 || (offset === 0 && lineCount > remaining && lineCount * LINE_HEIGHT + CELL_PADDING * 2 < 400)) {
          newPage(true);
          tableHeader(table, true);
        }
        const count = Math.min(lineCount - offset, Math.floor((CONTENT_BOTTOM - y - CELL_PADDING * 2) / LINE_HEIGHT));
        if (count < 1) throw new Error('Không đủ không gian để trình bày bảng báo cáo.');
        const height = count * LINE_HEIGHT + CELL_PADDING * 2;
        rect(MARGIN, y, CONTENT_WIDTH, height, row.strong ? colors.total : index % 2 ? colors.alternate : colors.white);
        let x = MARGIN;
        table.columns.forEach((column, cell) => {
          const align = column.align || 'left';
          const left = align === 'right' ? x + column.width - CELL_PADDING : align === 'center' ? x + column.width / 2 : x + CELL_PADDING;
          cells[cell].slice(offset, offset + count).forEach((label, lineIndex) => {
            text(label, left, y + CELL_PADDING + lineIndex * LINE_HEIGHT, TEXT_SIZE, row.strong, colors.ink, align);
          });
          x += column.width;
        });
        y += height;
        line(MARGIN, y, WIDTH - MARGIN, y);
        offset += count;
        if (offset < lineCount) { newPage(true); tableHeader(table, true); }
      }
    }
    if (table.total) {
      if (y + 35 > CONTENT_BOTTOM) { newPage(true); tableHeader(table, true); }
      rect(MARGIN, y, CONTENT_WIDTH, 35, colors.total);
      text(table.total.label, MARGIN + CELL_PADDING, y + 10, 10.5, true);
      text(table.total.value, WIDTH - MARGIN - CELL_PADDING, y + 10, 10.5, true, colors.ink, 'right');
      y += 35;
    }
    y += 18;
  }
  for (const section of sections) {
    currentSection = section;
    newPage();
    section.tables.forEach(drawTable);
  }
  return pages;
}

/** Returns the same PDF used for download so its pagination can be visually checked. */
export async function createProfitReportPdf(options: ExportProfitReportPdfOptions): Promise<jsPDF> {
  if (typeof document === 'undefined') throw new Error('Xuất báo cáo PDF cần chạy trong trình duyệt.');
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt chưa hỗ trợ tạo báo cáo PDF.');
  const pages = layoutReport(ctx, buildProfitPdfSections(options.report), options);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `Báo cáo lợi nhuận tháng ${options.monthYear}`,
    subject: 'Lợi nhuận, lương, chi, chiết khấu, doanh số nha khoa và giao vận',
    author: options.labProfile.labName || DEFAULT_LAB_PROFILE.labName,
  });
  for (let index = 0; index < pages.length; index++) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = colors.white;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (const command of pages[index].commands) {
      if (command.kind === 'rect') {
        ctx.fillStyle = command.color;
        ctx.fillRect(command.x, command.y, command.width, command.height);
      } else if (command.kind === 'line') {
        ctx.strokeStyle = command.color;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(command.x, command.y);
        ctx.lineTo(command.x2, command.y2);
        ctx.stroke();
      } else {
        setFont(ctx, command.size, command.bold);
        ctx.fillStyle = command.color;
        ctx.textAlign = command.align || 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(command.text, command.x, command.y);
      }
    }
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN, HEIGHT - 30);
    ctx.lineTo(WIDTH - MARGIN, HEIGHT - 30);
    ctx.stroke();
    setFont(ctx, 9);
    ctx.fillStyle = colors.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Báo cáo lợi nhuận | Kỳ ${options.monthYear} | Đơn vị tiền tệ VNĐ`, MARGIN, HEIGHT - 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Trang ${index + 1} / ${pages.length}`, WIDTH - MARGIN, HEIGHT - 22);
    if (index) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    // Yield between pages so a large report does not freeze the interface.
    if (index < pages.length - 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  canvas.width = 1;
  canvas.height = 1;
  return pdf;
}

export async function exportProfitReportToPdf(options: ExportProfitReportPdfOptions): Promise<void> {
  const pdf = await createProfitReportPdf(options);
  const safePeriod = options.monthYear.replace(/[^0-9]/g, '-');
  pdf.save(`Bao-Cao-Loi-Nhuan-${safePeriod}.pdf`);
}
