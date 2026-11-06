const header = document.querySelector('.header');
const spacer = document.querySelector('.pseudo-header');
const menu = document.querySelector('#mobile-menu');
const menuButton = document.querySelector('.toggle-mobile');
const closeButton = document.querySelector('.close-icon');
const form = document.querySelector('#search');
const code = document.querySelector('#check-code');
const agreement = document.querySelector('#agree-checkbox');
const codeError = document.querySelector('#code_validate');
const agreementError = document.querySelector('#tick_validate');
const lookupStatus = document.querySelector('.lookup-status');
const lookupButton = form.querySelector('button[type="submit"]');
const warrantyResult = document.querySelector('.warranty-result');
const lookupView = document.querySelector('#lookup-view');
const resultProductImage = document.querySelector('.thank-you__img');
const warrantyFields = document.querySelectorAll('[data-warranty]');
const quadrantFields = document.querySelectorAll('[data-quadrant]');
const quadrantNote = document.querySelector('.quadrant-note');
let activeLookup = null;
let lookupVersion = 0;

function updateHeader() {
  spacer.style.height = `${header.offsetHeight}px`;
}

function toggleMenu(open) {
  menu.classList.toggle('active', open);
  menu.setAttribute('aria-hidden', String(!open));
  menu.inert = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) closeButton.focus();
  else menuButton.focus();
}

menuButton.addEventListener('click', () => toggleMenu(true));
closeButton.addEventListener('click', () => toggleMenu(false));
menu.addEventListener('click', (event) => {
  if (event.target === menu) toggleMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (!menu.classList.contains('active')) return;
  if (event.key === 'Escape') toggleMenu(false);
  if (event.key === 'Tab') {
    const links = [...menu.querySelectorAll('a[href], button')].filter((item) => item.getClientRects().length);
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

const mobileProducts = document.querySelector('.mobile-product-toggle');
mobileProducts.addEventListener('click', (event) => {
  event.preventDefault();
  const expanded = mobileProducts.parentElement.classList.toggle('show');
  mobileProducts.setAttribute('aria-expanded', String(expanded));
});

function showError(field, message, invalid) {
  message.hidden = !invalid;
  field.setAttribute('aria-invalid', String(invalid));
}

function setLoading(loading) {
  lookupButton.disabled = loading;
  lookupButton.textContent = loading ? 'Đang tra cứu…' : 'Kiểm tra ngay';
  form.setAttribute('aria-busy', String(loading));
}

function setLookupStatus(message, state) {
  lookupStatus.textContent = message;
  lookupStatus.dataset.state = state;
  lookupStatus.hidden = false;
}

function resetLookup() {
  lookupVersion += 1;
  activeLookup?.abort();
  activeLookup = null;
  warrantyResult.hidden = true;
  lookupView.hidden = false;
  warrantyFields.forEach((field) => { field.textContent = ''; });
  quadrantFields.forEach((field) => { field.textContent = ''; });
  quadrantNote.textContent = '';
  quadrantNote.hidden = true;
  lookupStatus.textContent = '';
  lookupStatus.hidden = true;
  setLoading(false);
}

async function lookupWarranty(requestedCode) {
  resetLookup();
  const version = lookupVersion;
  const controller = new AbortController();
  activeLookup = controller;
  const timeout = window.setTimeout(() => controller.abort(), 40000);
  setLoading(true);
  setLookupStatus('Đang tải thông tin bảo hành…', 'loading');

  try {
    const response = await fetch('data.php', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ code: requestedCode, agree: '1' }),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    const data = await response.json();
    if (version !== lookupVersion) return;
    if (!response.ok) throw new Error(data.message || 'Không thể tải dữ liệu bảo hành. Vui lòng thử lại sau.');
    if (data.status === 'not_found') {
      setLookupStatus('Không tìm thấy mã bảo hành. Vui lòng kiểm tra lại mã thẻ.', 'not-found');
      return;
    }
    if (data.status !== 'found' || !data.record || typeof data.record !== 'object' || Array.isArray(data.record)) {
      throw new Error('Dữ liệu bảo hành chưa hợp lệ. Vui lòng thử lại sau.');
    }
    warrantyFields.forEach((field) => {
      const value = data.record[field.dataset.warranty];
      field.textContent = (typeof value === 'string' || typeof value === 'number') && String(value).trim()
        ? String(value)
        : 'Chưa cập nhật';
    });
    const rawPositions = typeof data.record.toothPosition === 'string' ? data.record.toothPosition.trim() : '';
    if (typeof window.UNCToothPositions?.renderQuadrants === 'function') {
      window.UNCToothPositions.renderQuadrants(document.querySelector('.tooth-position'), rawPositions);
    } else {
      // Keep the source visible if a hosting cache serves a mismatched script.
      quadrantNote.textContent = rawPositions ? `Vị trí răng: ${rawPositions}` : 'Chưa cập nhật vị trí răng';
      quadrantNote.hidden = false;
    }
    const isEverest = /everest/i.test(String(data.record.material || ''));
    const isRazor = /razor/i.test(String(data.record.material || ''));
    resultProductImage.hidden = !isEverest && !isRazor;
    resultProductImage.src = isEverest
      ? 'https://uncsea.com/storage/everest-01.webp'
      : 'https://uncsea.com/storage/razor-01.webp';
    resultProductImage.alt = isEverest ? 'Phôi Zirconia đa lớp Everest' : 'Phôi Zirconia UNC';
    lookupView.hidden = true;
    warrantyResult.hidden = false;
    setLookupStatus('Đã tìm thấy thông tin bảo hành.', 'found');
    warrantyResult.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (error) {
    if (version !== lookupVersion) return;
    const message = error.name === 'AbortError'
      ? 'Kết nối mất quá nhiều thời gian. Vui lòng thử lại.'
      : error instanceof SyntaxError || error instanceof TypeError
        ? 'Không thể kết nối dữ liệu bảo hành. Vui lòng thử lại sau.'
        : error.message;
    setLookupStatus(message, 'error');
  } finally {
    window.clearTimeout(timeout);
    if (version === lookupVersion) {
      activeLookup = null;
      setLoading(false);
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  resetLookup();
  const missingCode = !code.value.trim();
  const missingAgreement = !agreement.checked;
  showError(code, codeError, missingCode);
  showError(agreement, agreementError, missingAgreement);
  if (missingCode || missingAgreement) {
    (missingCode ? code : agreement).focus();
  } else {
    code.value = code.value.trim();
    lookupWarranty(code.value);
  }
});
code.addEventListener('input', () => {
  resetLookup();
  if (code.value.trim()) showError(code, codeError, false);
});
agreement.addEventListener('change', () => {
  resetLookup();
  if (agreement.checked) showError(agreement, agreementError, false);
});

window.addEventListener('scroll', () => {
  header.classList.toggle('is-scrolled', window.scrollY > 0);
}, { passive: true });
window.addEventListener('resize', () => {
  updateHeader();
  if (window.innerWidth >= 965 && menu.classList.contains('active')) toggleMenu(false);
});
new ResizeObserver(updateHeader).observe(header);
document.fonts.ready.then(updateHeader);
updateHeader();
