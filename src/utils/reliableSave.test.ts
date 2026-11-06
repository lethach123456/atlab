import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOnlineForSave,
  formatSaveError,
  formSnapshot,
  isBrowserOffline,
  newStableId,
  reuseOrCreateStableId,
} from './reliableSave';

test('newStableId is deterministic prefix and valid firestore-ish id', () => {
  const id = newStableId('order');
  assert.match(id, /^order_[a-zA-Z0-9]+$/);
  assert.ok(id.length <= 128);
  assert.notEqual(newStableId('order'), newStableId('order'));
});

test('formatSaveError unwraps JSON firestore dumps without leaking nested auth', () => {
  const raw = JSON.stringify({
    error: 'permission-denied',
    authInfo: { email: 'secret@example.com', userId: 'uid' },
  });
  const msg = formatSaveError(new Error(raw));
  assert.match(msg, /Không có quyền lưu|quyền ghi/i);
  assert.doesNotMatch(msg, /Đăng nhập lại rồi thử|deploy lại rules|permission-denied|Firestore rules/i);
  assert.equal(msg.includes('secret@example.com'), false);
});

test('formatSaveError separates permission-denied from unauthenticated', () => {
  const denied = Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
  const deniedMsg = formatSaveError(denied);
  assert.match(deniedMsg, /Không có quyền lưu|quyền ghi/i);
  assert.doesNotMatch(deniedMsg, /Đăng nhập lại rồi thử|deploy lại rules|permission-denied|Firestore rules/i);

  const unauth = Object.assign(new Error('User not authenticated'), {
    code: 'unauthenticated',
  });
  const unauthMsg = formatSaveError(unauth);
  assert.match(unauthMsg, /Đăng nhập lại|phiên đăng nhập đã hết/i);
  assert.doesNotMatch(unauthMsg, /deploy lại rules|permission-denied|Firestore rules/i);
});

test('formatSaveError rewrites old misleading combined permission copy', () => {
  const msg = formatSaveError(
    new Error('Không có quyền lưu hoặc phiên đăng nhập đã hết. Đăng nhập lại rồi thử.')
  );
  assert.match(msg, /Không có quyền lưu|quyền ghi/i);
  assert.doesNotMatch(msg, /Không có quyền lưu hoặc phiên đăng nhập đã hết|deploy lại rules|permission-denied/i);
});

test('formatSaveError maps network wording', () => {
  assert.match(formatSaveError(new Error('Firestore unavailable')), /kết nối|máy chủ|Thử lại/i);
});

test('formatSaveError keeps plain vietnamese messages', () => {
  assert.equal(
    formatSaveError(new Error('Đang offline — chưa lưu. Kiểm tra mạng rồi bấm Thử lại.')),
    'Đang offline — chưa lưu. Kiểm tra mạng rồi bấm Thử lại.'
  );
});

test('reuseOrCreateStableId reuses valid id and mints otherwise', () => {
  assert.equal(reuseOrCreateStableId('order', 'order_abc123'), 'order_abc123');
  assert.match(reuseOrCreateStableId('cf', ''), /^cf_/);
  assert.match(reuseOrCreateStableId('cf', 'bad id!'), /^cf_/);
});

test('formSnapshot is key-order stable', () => {
  assert.equal(formSnapshot({ b: 1, a: 'x' }), formSnapshot({ a: 'x', b: 1 }));
  assert.notEqual(formSnapshot({ a: 'x' }), formSnapshot({ a: 'y' }));
});

test('assertOnlineForSave throws when navigator reports offline', () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: false },
  });
  try {
    assert.equal(isBrowserOffline(), true);
    assert.throws(() => assertOnlineForSave(), /offline|Thử lại/i);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: original,
    });
  }
});
