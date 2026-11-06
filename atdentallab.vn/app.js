const form = document.querySelector('#lookup'), input = document.querySelector('#code'), message = document.querySelector('#message'), result = document.querySelector('#result'), submit = document.querySelector('#submit');
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function item(container, label, value, className = '') { const div = element('div', 'certificate-field ' + className); div.append(element('span', 'field-label', label), element('strong', 'field-value', value || '—')); container.append(div); }
function expiration(date, years, period) {
  if (/trọn đời|vĩnh viễn/i.test(period || '')) return 'Trọn đời';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date || '');
  if (!m || !Number.isInteger(years) || years <= 0) return '';
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return '';
  const targetYear = year + years, lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${String(Math.min(day,lastDay)).padStart(2,'0')}/${String(month).padStart(2,'0')}/${targetYear}`;
}
function renderCertificate(data) {
  const cert = element('article', 'certificate');
  const head = element('header', 'certificate-head');
  head.append(element('div', 'certificate-eyebrow', '♙  CHỨNG NHẬN PHỤC HÌNH RĂNG SỨ CHÍNH HÃNG'), element('h2', 'certificate-title', 'AT DENTAL LABORATORY'), element('p', 'certificate-subtitle', 'TRUNG TÂM RĂNG SỨ CHẤT LƯỢNG CAO · CAD/CAM DIGITAL LAB'));
  const badge = element('div', 'certificate-badge'); badge.append(element('span', '', 'MÃ THẺ BẢO HÀNH:'), element('strong', '', data.warrantyCode || '—')); head.append(badge); cert.append(head);
  const cards = element('div', 'certificate-grid');
  const customer = element('section', 'certificate-panel'); customer.append(element('h3', '', 'THÔNG TIN KHÁCH HÀNG & ĐỐI TÁC'));
  item(customer, 'Họ và tên khách hàng:', data.patientName, 'customer-name'); item(customer, 'Số điện thoại:', data.phone); item(customer, 'Nha khoa điều trị:', data.clinicName); if (data.clinicAddress) item(customer, 'Địa chỉ:', data.clinicAddress); cards.append(customer);
  const restorative = element('section', 'certificate-panel'); restorative.append(element('h3', '', '✧  QUY CÁCH PHỤC HÌNH & THỜI HẠN'));
  const restorations = Array.isArray(data.restorations) ? data.restorations : [];
  if (!restorations.length) item(restorative, 'Thông tin phục hình:', 'Chưa có thông tin');
  restorations.forEach((row, index) => { const section = element('div', 'restoration-block'); if (restorations.length > 1) section.append(element('h4', 'restoration-title', `Phục hình ${index+1}`)); item(section, 'Dòng sứ / Vật liệu phục hình:', row.material, 'material'); const grid = element('div', 'certificate-details'); item(grid, 'Thời hạn bảo hành:', row.warrantyPeriod, 'warranty-term'); item(grid, 'Dáng răng:', row.toothForm); item(grid, 'Ngày lắp đặt:', row.orderDate); item(grid, 'Có giá trị đến:', expiration(row.orderDate, Number(row.warrantyYears), row.warrantyPeriod), 'expiry'); section.append(grid); if (restorations.length > 1 && row.teeth) item(section, 'Vị trí răng:', row.teeth); restorative.append(section); }); cards.append(restorative); cert.append(cards);
  const teeth = element('section', 'teeth-panel'); const teethHead = element('div', 'teeth-heading'); teethHead.append(element('h3', '', 'VỊ TRÍ RĂNG BẢO HÀNH:'), element('strong', '', data.teeth || 'Chưa có thông tin')); teeth.append(teethHead); if (window.ATTeeth) teeth.append(window.ATTeeth.createToothDiagram(data.teeth || '')); cert.append(teeth); result.replaceChildren(cert); result.hidden = false;
}
form.addEventListener('submit', async e => { e.preventDefault(); const code = input.value.trim().toUpperCase(); result.hidden = true; result.replaceChildren(); message.textContent = ''; if (!/^[A-Z0-9_-]{1,64}$/.test(code)) { message.textContent = 'Vui lòng nhập mã bảo hành hợp lệ.'; return; } submit.disabled = true; submit.textContent = 'Đang tra cứu…'; try { const response = await fetch('lookup.php?code=' + encodeURIComponent(code), { headers: { Accept:'application/json' }, cache:'no-store' }); const data = await response.json(); if (!response.ok) { message.textContent = response.status === 404 ? 'Không tìm thấy mã bảo hành. Vui lòng kiểm tra lại.' : response.status === 409 ? 'Mã bảo hành cần được kiểm tra thêm. Vui lòng liên hệ AT Dental Lab.' : 'Chưa thể tra cứu lúc này. Vui lòng thử lại sau.'; return; } renderCertificate(data); result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch { message.textContent = 'Không kết nối được dịch vụ tra cứu. Vui lòng thử lại sau.'; } finally { submit.disabled = false; submit.textContent = 'Tra cứu'; } });
const logos = document.querySelector('.logos'); document.querySelector('.carousel-prev').addEventListener('click', () => logos.scrollBy({left:-logos.clientWidth/2,behavior:'smooth'})); document.querySelector('.carousel-next').addEventListener('click', () => logos.scrollBy({left:logos.clientWidth/2,behavior:'smooth'}));
