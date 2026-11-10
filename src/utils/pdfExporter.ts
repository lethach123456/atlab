import { jsPDF } from 'jspdf';
import { DentalOrder, LabProfileConfig } from '../types/dental';
import { formatVND, DEFAULT_LAB_PROFILE } from './financeUtils';
import { displayMaterialName } from './materialDisplayName';

export interface ExportInvoicePdfOptions {
  orders: DentalOrder[];
  clinicName: string;
  monthYear: string;
  paidAmount?: number;
  shippingFeeTotal?: number;
  previousMonthDebt?: number;
  additionalCharges?: number;
  discountAmount?: number;
  openingAdjustment?: number;
  orderSubtotal?: number;
  previousMonthLabel?: string;
  labProfile: LabProfileConfig;
  invoiceCode: string;
}

const A4_WIDTH = 794; // px at 96 DPI (210mm)
const A4_HEIGHT = 1123; // px at 96 DPI (297mm)
const SCALE = 2.5; // High-DPI rendering for crisp text

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      // If a single word is wider than maxWidth, slice characters
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function exportInvoiceToPdf(
  options: ExportInvoicePdfOptions
): Promise<void> {
  const {
    orders,
    clinicName,
    monthYear,
    paidAmount = 0,
    shippingFeeTotal = 0,
    previousMonthDebt = 0,
    additionalCharges = 0,
    discountAmount = 0,
    openingAdjustment = 0,
    orderSubtotal,
    previousMonthLabel = '',
    labProfile: rawProfile,
    invoiceCode,
  } = options;

  const profile: LabProfileConfig = {
    labName: rawProfile.labName || DEFAULT_LAB_PROFILE.labName,
    tagline: rawProfile.tagline || DEFAULT_LAB_PROFILE.tagline,
    hotline: rawProfile.hotline || DEFAULT_LAB_PROFILE.hotline,
    address: rawProfile.address || DEFAULT_LAB_PROFILE.address,
    email: rawProfile.email || DEFAULT_LAB_PROFILE.email,
    bankName: rawProfile.bankName || DEFAULT_LAB_PROFILE.bankName,
    bankAccountNumber:
      rawProfile.bankAccountNumber || DEFAULT_LAB_PROFILE.bankAccountNumber,
    bankAccountHolder:
      rawProfile.bankAccountHolder || DEFAULT_LAB_PROFILE.bankAccountHolder,
    directorName: rawProfile.directorName || DEFAULT_LAB_PROFILE.directorName,
  };

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue if font ready check fails
    }
  }

  const totalTeeth = orders.reduce((s, o) => s + (o.teethCount || 1), 0);
  const subtotal = orderSubtotal ?? orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const grandTotal = subtotal + previousMonthDebt + additionalCharges + shippingFeeTotal - discountAmount;
  const remainingBalance = Math.max(0, grandTotal - paidAmount - openingAdjustment);

  const clinicAddress =
    orders.find((o) => o.clinicAddress && o.clinicAddress.trim() !== '')
      ?.clinicAddress || 'Đà Nẵng';
  const clinicPhone =
    orders.find((o) => o.phone && o.phone.trim() !== '')?.phone || '';

  const marginX = 38;
  const contentWidth = A4_WIDTH - marginX * 2; // 718px
  const showClinicCol = !clinicName;

  // Define table columns totaling 718px
  const columns = showClinicCol
    ? [
        { key: 'stt', label: 'STT', width: 32, align: 'center' as const },
        { key: 'date', label: 'NGÀY', width: 68, align: 'left' as const },
        { key: 'code', label: 'MÃ BH', width: 64, align: 'left' as const },
        { key: 'patient', label: 'KHÁCH HÀNG', width: 112, align: 'left' as const },
        { key: 'clinic', label: 'NHA KHOA', width: 92, align: 'left' as const },
        { key: 'material', label: 'DÒNG SỨ', width: 110, align: 'left' as const },
        { key: 'teeth', label: 'VỊ TRÍ RĂNG', width: 102, align: 'left' as const },
        { key: 'count', label: 'SL', width: 36, align: 'center' as const },
        { key: 'total', label: 'THÀNH TIỀN', width: 102, align: 'right' as const },
      ]
    : [
        { key: 'stt', label: 'STT', width: 36, align: 'center' as const },
        { key: 'date', label: 'NGÀY', width: 74, align: 'left' as const },
        { key: 'code', label: 'MÃ BH', width: 72, align: 'left' as const },
        { key: 'patient', label: 'HỌ TÊN KHÁCH HÀNG', width: 148, align: 'left' as const },
        { key: 'material', label: 'DÒNG SỨ / VẬT LIỆU', width: 136, align: 'left' as const },
        { key: 'teeth', label: 'VỊ TRÍ RĂNG', width: 110, align: 'left' as const },
        { key: 'count', label: 'SL', width: 40, align: 'center' as const },
        { key: 'total', label: 'THÀNH TIỀN', width: 102, align: 'right' as const },
      ];

  const createPageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = A4_WIDTH * SCALE;
    canvas.height = A4_HEIGHT * SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);
    return { canvas, ctx };
  };

  const pages: HTMLCanvasElement[] = [];
  let { canvas, ctx } = createPageCanvas();
  pages.push(canvas);

  const fontSans = "'Be Vietnam Pro', system-ui, -apple-system, sans-serif";
  const fontMono = "'JetBrains Mono', monospace";

  // --- DRAW HEADER ON FIRST PAGE ---
  let y = 38;
  const headerRight = A4_WIDTH - marginX;
  const invoiceWidth = 296;
  const labWidth = contentWidth - invoiceWidth - 20;
  const drawHeaderText = (text: string, x: number, top: number, width: number, lineHeight: number) => {
    const lines = wrapText(ctx, text, width);
    lines.forEach((line, index) => ctx.fillText(line, x, top + (index + 1) * lineHeight - 3));
    return top + lines.length * lineHeight;
  };

  // Lab information occupies its own column, including when contact lines wrap.
  ctx.fillStyle = '#0f172a';
  drawRoundedRect(ctx, marginX, y, 30, 30, 7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 12px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.fillText('AT', marginX + 15, y + 19);

  const labTextX = marginX + 40;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 14px ${fontSans}`;
  let labY = drawHeaderText(profile.labName.toUpperCase(), labTextX, y, labWidth - 40, 18);
  ctx.fillStyle = '#475569';
  ctx.font = `500 9.5px ${fontSans}`;
  labY = drawHeaderText(profile.tagline, labTextX, labY, labWidth - 40, 13);

  labY = Math.max(labY, y + 30) + 4;
  ctx.font = `400 9.5px ${fontSans}`;
  for (const line of [
    `Địa chỉ: ${profile.address}`,
    `Hotline Kỹ Thuật & Kế Toán: ${profile.hotline}`,
    `TK Ngân hàng: ${profile.bankAccountNumber} (${profile.bankName}) - Chủ TK: ${profile.bankAccountHolder}`,
  ]) {
    labY = drawHeaderText(line, marginX, labY, labWidth, 13);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f1f5f9';
  const badgeText = `Số HĐ: ${invoiceCode}`;
  ctx.font = `700 9.5px ${fontMono}`;
  const badgeW = Math.min(invoiceWidth, ctx.measureText(badgeText).width + 16);
  drawRoundedRect(ctx, headerRight - badgeW, y, badgeW, 20, 5);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.fillText(badgeText, headerRight - 8, y + 13.5, badgeW - 16);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = `800 12px ${fontSans}`;
  let invoiceY = drawHeaderText('HÓA ĐƠN / BẢNG KÊ PHỤC HÌNH RĂNG SỨ', headerRight, y + 25, invoiceWidth, 16);
  ctx.fillStyle = '#334155';
  ctx.font = `600 10px ${fontSans}`;
  invoiceY = drawHeaderText(
    `Kỳ kết toán: ${monthYear ? `Tháng ${monthYear}` : 'Toàn bộ các kỳ'}`,
    headerRight, invoiceY, invoiceWidth, 14
  );
  ctx.fillStyle = '#64748b';
  ctx.font = `400 9.5px ${fontSans}`;
  invoiceY = drawHeaderText(
    `Ngày xuất bảng kê: ${new Date().toLocaleDateString('vi-VN')}`,
    headerRight, invoiceY, invoiceWidth, 13
  );

  y = Math.max(labY, invoiceY) + 10;

  // Header divider line
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(A4_WIDTH - marginX, y);
  ctx.stroke();

  y += 16;

  // --- PARTNER CLINIC & SUMMARY CARDS ---
  const cardH = 82;
  const leftCardW = 450;
  const rightCardW = contentWidth - leftCardW - 14;

  // Left Card: Clinic Info
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, marginX, y, leftCardW, cardH, 10);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `700 10px ${fontSans}`;
  ctx.fillText('ĐƠN VỊ NHA KHOA / KHÁCH HÀNG ĐỐI TÁC', marginX + 14, y + 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 14.5px ${fontSans}`;
  ctx.fillText(
    clinicName || 'TỔNG HỢP TẤT CẢ NHA KHOA ĐỐI TÁC',
    marginX + 14,
    y + 42
  );

  ctx.fillStyle = '#475569';
  ctx.font = `400 11px ${fontSans}`;
  const subClinicLine = clinicName
    ? `Địa chỉ: ${clinicAddress}${clinicPhone ? `  ·  ĐT: ${clinicPhone}` : ''}`
    : `Tổng số đơn hàng trong kỳ: ${orders.length} ca (${totalTeeth} răng)`;
  ctx.fillText(subClinicLine, marginX + 14, y + 63);

  // Right Card: Total Remaining Balance
  const rightCardX = marginX + leftCardW + 14;
  ctx.fillStyle = '#eff6ff';
  drawRoundedRect(ctx, rightCardX, y, rightCardW, cardH, 10);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1e40af';
  ctx.font = `700 10px ${fontSans}`;
  ctx.fillText('TỔNG CỘNG PHẢI THANH TOÁN', rightCardX + 14, y + 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 19px ${fontMono}`;
  ctx.fillText(formatVND(remainingBalance), rightCardX + 14, y + 46);

  ctx.fillStyle = '#1d4ed8';
  ctx.font = `500 10px ${fontSans}`;
  const prevShort = previousMonthLabel ? previousMonthLabel.split('/')[0] : '';
  const summaryNote =
    previousMonthDebt > 0
      ? `${orders.length} ca (${totalTeeth} răng) · +Nợ T${prevShort}: ${formatVND(previousMonthDebt)}`
      : `Tổng ${orders.length} ca (${totalTeeth} răng)${
          paidAmount > 0 ? ` · Đã TT: ${formatVND(paidAmount)}` : ''
        }`;
  ctx.fillText(summaryNote, rightCardX + 14, y + 66);

  y += cardH + 18;

  // --- TABLE HEADER DRAWER ---
  const drawTableHeader = (topY: number): number => {
    const headerH = 28;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(marginX, topY, contentWidth, headerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 10px ${fontSans}`;
    let colX = marginX;
    for (const col of columns) {
      if (col.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(col.label, colX + col.width / 2, topY + 18);
      } else if (col.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(col.label, colX + col.width - 8, topY + 18);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(col.label, colX + 8, topY + 18);
      }
      colX += col.width;
    }
    return topY + headerH;
  };

  y = drawTableHeader(y);

  // --- TABLE ROWS ---
  const maxPageY = A4_HEIGHT - 65;

  if (orders.length === 0) {
    const emptyH = 38;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(marginX, y, contentWidth, emptyH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentWidth, emptyH);
    ctx.fillStyle = '#64748b';
    ctx.font = `500 11px ${fontSans}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      'Không có ca phục hình phát sinh trong danh sách này.',
      marginX + contentWidth / 2,
      y + 23
    );
    y += emptyH;
  } else {
    orders.forEach((order, idx) => {
      ctx.font = `500 10.5px ${fontSans}`;
      const rowValues: Record<string, string[]> = {
        stt: [String(idx + 1)],
        date: [order.orderDate || ''],
        code: [order.warrantyCode || ''],
        patient: wrapText(ctx, order.patientName || '', showClinicCol ? 98 : 134),
        clinic: showClinicCol ? wrapText(ctx, order.clinicName || '', 78) : [''],
        material: wrapText(ctx, displayMaterialName(order.material), showClinicCol ? 96 : 122),
        teeth: wrapText(ctx, order.teeth || '', showClinicCol ? 88 : 96),
        count: [String(order.teethCount || 1)],
        total: [formatVND(order.totalAmount || 0)],
      };

      const maxLines = Math.max(
        rowValues.patient.length,
        rowValues.clinic.length,
        rowValues.material.length,
        rowValues.teeth.length,
        1
      );
      const rowH = Math.max(26, maxLines * 14 + 10);

      // Check pagination
      if (y + rowH > maxPageY) {
        const nextPage = createPageCanvas();
        canvas = nextPage.canvas;
        ctx = nextPage.ctx;
        pages.push(canvas);
        y = 38;
        y = drawTableHeader(y);
      }

      // Row background
      ctx.fillStyle = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(marginX, y, contentWidth, rowH);

      // Cell borders & text
      let colX = marginX;
      for (const col of columns) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.75;
        ctx.strokeRect(colX, y, col.width, rowH);

        const lines = rowValues[col.key] || [''];
        const isMono =
          col.key === 'stt' ||
          col.key === 'date' ||
          col.key === 'code' ||
          col.key === 'count' ||
          col.key === 'total';
        const isBold =
          col.key === 'code' ||
          col.key === 'patient' ||
          col.key === 'count' ||
          col.key === 'total';

        ctx.font = `${isBold ? 700 : 500} 10.5px ${isMono ? fontMono : fontSans}`;
        ctx.fillStyle =
          col.key === 'stt'
            ? '#64748b'
            : col.key === 'total' || col.key === 'patient' || col.key === 'code'
            ? '#0f172a'
            : '#334155';

        lines.forEach((line, lIdx) => {
          const textY = y + 16 + lIdx * 14;
          if (col.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(line, colX + col.width / 2, textY);
          } else if (col.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(line, colX + col.width - 8, textY);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(line, colX + 8, textY);
          }
        });

        colX += col.width;
      }

      y += rowH;
    });
  }

  // --- SUMMARY FOOTER & SIGNATURES ---
  const summaryRowsCount =
    2 +
    (previousMonthDebt > 0 ? 1 : 0) +
    (additionalCharges > 0 ? 1 : 0) +
    (discountAmount > 0 ? 1 : 0) +
    (openingAdjustment > 0 ? 1 : 0) +
    (shippingFeeTotal > 0 ? 1 : 0) +
    (paidAmount > 0 ? 1 : 0);
  const footerNeededH = summaryRowsCount * 28 + 165;

  if (y + footerNeededH > A4_HEIGHT - 45) {
    const nextPage = createPageCanvas();
    canvas = nextPage.canvas;
    ctx = nextPage.ctx;
    pages.push(canvas);
    y = 42;
  }

  const drawSummaryRow = (
    label: string,
    valueText: string,
    opts?: {
      bg?: string;
      textColor?: string;
      valueColor?: string;
      teethBadge?: string;
      isGrand?: boolean;
    }
  ) => {
    const h = opts?.isGrand ? 34 : 26;
    ctx.fillStyle = opts?.bg || '#f8fafc';
    ctx.fillRect(marginX, y, contentWidth, h);
    ctx.strokeStyle = opts?.isGrand ? '#0f172a' : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentWidth, h);

    const lastColW = columns[columns.length - 1].width;
    const countColW = columns[columns.length - 2].width;
    const labelEndX =
      A4_WIDTH - marginX - lastColW - (opts?.teethBadge ? countColW : 0);

    ctx.textAlign = 'right';
    ctx.fillStyle = opts?.textColor || '#0f172a';
    ctx.font = `700 ${opts?.isGrand ? '11.5px' : '10.5px'} ${fontSans}`;
    ctx.fillText(label, labelEndX - 10, y + (opts?.isGrand ? 21 : 17));

    if (opts?.teethBadge) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f766e';
      ctx.font = `700 10.5px ${fontMono}`;
      ctx.fillText(opts.teethBadge, labelEndX + countColW / 2, y + 17);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = opts?.valueColor || opts?.textColor || '#0f172a';
    ctx.font = `800 ${opts?.isGrand ? '13.5px' : '11px'} ${fontMono}`;
    ctx.fillText(
      valueText,
      A4_WIDTH - marginX - 8,
      y + (opts?.isGrand ? 22 : 17)
    );

    y += h;
  };

  drawSummaryRow(
    orderSubtotal === undefined ? `TỔNG TIỀN PHỤC HÌNH RĂNG SỨ (${orders.length} CA):` : 'PHÁT SINH THEO BẢNG CÔNG NỢ ĐÃ CHỐT:',
    formatVND(subtotal),
    {
      bg: '#f1f5f9',
      teethBadge: `${totalTeeth} răng`,
    }
  );

  if (previousMonthDebt > 0) {
    const prevLabel = previousMonthLabel
      ? `CÔNG NỢ THÁNG TRƯỚC (THÁNG ${previousMonthLabel}):`
      : 'CÔNG NỢ THÁNG TRƯỚC CHUYỂN SANG:';
    drawSummaryRow(prevLabel, `+ ${formatVND(previousMonthDebt)}`, {
      bg: '#fffbeb',
      textColor: '#92400e',
      valueColor: '#b45309',
    });
  }

  if (additionalCharges > 0) {
    drawSummaryRow(
      'PHÁT SINH CÔNG NỢ NHẬP THÊM TRONG KỲ:',
      `+ ${formatVND(additionalCharges)}`,
      {
        bg: '#ffffff',
        textColor: '#334155',
      }
    );
  }

  if (shippingFeeTotal > 0) {
    drawSummaryRow(
      'CƯỚC PHÍ GIAO VẬN MẪU & PHỤC HÌNH:',
      formatVND(shippingFeeTotal),
      {
        bg: '#ffffff',
        textColor: '#334155',
      }
    );
  }

  if (discountAmount > 0) {
    drawSummaryRow('CHIẾT KHẤU NHA KHOA:', `- ${formatVND(discountAmount)}`, { bg: '#ecfdf5', textColor: '#065f46' });
  }

  if (paidAmount > 0) {
    drawSummaryRow(
      'SỐ TIỀN ĐÃ THANH TOÁN / TẠM ỨNG TRONG KỲ:',
      `- ${formatVND(paidAmount)}`,
      {
        bg: '#ecfdf5',
        textColor: '#065f46',
        valueColor: '#047857',
      }
    );
  }

  if (openingAdjustment > 0) {
    drawSummaryRow('ĐIỀU CHỈNH THEO SỐ DƯ ĐÃ CHỐT:', `- ${formatVND(openingAdjustment)}`, { bg: '#f1f5f9' });
  }

  drawSummaryRow(
    'TỔNG SỐ TIỀN CÒN LẠI CẦN THANH TOÁN:',
    formatVND(remainingBalance),
    {
      bg: '#0f172a',
      textColor: '#ffffff',
      valueColor: '#38bdf8',
      isGrand: true,
    }
  );

  // --- BANK INFO & SIGNATURES ---
  y += 22;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(A4_WIDTH - marginX, y);
  ctx.stroke();

  y += 18;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('Thông Tin Chuyển Khoản Thanh Toán:', marginX, y);

  ctx.fillStyle = '#334155';
  ctx.font = `400 10.5px ${fontSans}`;
  ctx.fillText(`Ngân hàng: ${profile.bankName}`, marginX, y + 18);
  ctx.font = `700 11px ${fontMono}`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`Số TK: ${profile.bankAccountNumber}`, marginX, y + 34);
  ctx.font = `500 10.5px ${fontSans}`;
  ctx.fillStyle = '#334155';
  ctx.fillText(`Chủ TK: ${profile.bankAccountHolder}`, marginX, y + 50);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 10px ${fontSans}`;
  ctx.fillText(
    `Nội dung CK: ${clinicName || 'NhaKhoa'} TT ${monthYear || 'CongNo'}`,
    marginX,
    y + 66
  );

  // Representative 1: Clinic
  const col2CenterX = marginX + 380;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('Đại Diện Nha Khoa Đối Tác', col2CenterX, y);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 10px ${fontSans}`;
  ctx.fillText('(Ký và ghi rõ họ tên)', col2CenterX, y + 15);
  ctx.fillStyle = '#1e293b';
  ctx.font = `600 11px ${fontSans}`;
  ctx.fillText(clinicName || '........................', col2CenterX, y + 86);

  // Representative 2: Lab
  const col3CenterX = A4_WIDTH - marginX - 95;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText(`Đại Diện ${profile.labName}`, col3CenterX, y);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 10px ${fontSans}`;
  ctx.fillText('(Ký xác nhận đối soát)', col3CenterX, y + 15);

  // Verified stamp box
  const stampW = 136;
  const stampH = 22;
  ctx.fillStyle = '#ecfdf5';
  drawRoundedRect(ctx, col3CenterX - stampW / 2, y + 34, stampW, stampH, 4);
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#047857';
  ctx.font = `700 9.5px ${fontSans}`;
  ctx.fillText('ĐÃ ĐỐI SOÁT SỐ LIỆU', col3CenterX, y + 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText(profile.directorName, col3CenterX, y + 86);

  // --- PAGE NUMBERS ---
  const totalPages = pages.length;
  pages.forEach((pCanvas, idx) => {
    const pCtx = pCanvas.getContext('2d')!;
    pCtx.fillStyle = '#94a3b8';
    pCtx.font = `500 9.5px ${fontMono}`;
    pCtx.textAlign = 'right';
    pCtx.fillText(
      `Trang ${idx + 1} / ${totalPages}  ·  ${invoiceCode}`,
      A4_WIDTH - marginX,
      A4_HEIGHT - 18
    );
  });

  // --- PACK INTO JSPDF & TRIGGER DOWNLOAD ---
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pCanvas, idx) => {
    if (idx > 0) {
      pdf.addPage();
    }
    const imgData = pCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const safeClinic = (clinicName || 'Tong-Hop')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const safePeriod = (monthYear || 'Tat-Ca').replace('/', '-');
  const fileName = `Hoa-Don-AT-Dental-${safeClinic}-${safePeriod}.pdf`;

  pdf.save(fileName);
}
