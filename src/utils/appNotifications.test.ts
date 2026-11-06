import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotifyItem,
  dismissNotification,
  enqueueNotification,
  notificationDedupeKey,
  recordDedupeHit,
  sanitizeNotifyText,
  defaultDismissMs,
} from './appNotifications';

test('sanitize strips secrets and truncates', () => {
  const text = sanitizeNotifyText(`token ghp_${'a'.repeat(40)} end ${'x'.repeat(400)}`);
  assert.match(text, /\[redacted\]/);
  assert.ok(text.length <= 280);
});

test('dedupe key stable for same content', () => {
  const a = notificationDedupeKey({ tone: 'error', title: 'Lỗi', message: 'Chưa lưu' });
  const b = notificationDedupeKey({ tone: 'error', title: 'Lỗi', message: 'Chưa lưu' });
  assert.equal(a, b);
});

test('dedupe key ignores title so App+local catch collapse', () => {
  const a = notificationDedupeKey({ tone: 'error', title: 'Không đồng bộ được', message: 'Chưa lưu' });
  const b = notificationDedupeKey({ tone: 'error', title: 'Chưa lưu đơn', message: 'Chưa lưu' });
  assert.equal(a, b);
});

test('recordDedupeHit blocks repeats inside window', () => {
  const recent = new Map<string, number>();
  const key = 'error|Lỗi|msg';
  assert.equal(recordDedupeHit(recent, key, 1000, 4000), false);
  assert.equal(recordDedupeHit(recent, key, 2000, 4000), true);
  assert.equal(recordDedupeHit(recent, key, 6000, 4000), false);
});

test('defaultDismissMs: error persists, success auto', () => {
  assert.equal(defaultDismissMs('error'), null);
  assert.equal(defaultDismissMs('success'), 4000);
  assert.equal(defaultDismissMs('error', false), 12_000);
  assert.equal(defaultDismissMs('success', true), null);
});

test('enqueue replaces same id and caps stack', () => {
  const first = buildNotifyItem({ tone: 'info', title: 'A', message: '1', id: 'x' }, 1);
  const second = buildNotifyItem({ tone: 'info', title: 'B', message: '2', id: 'x' }, 2);
  let queue = enqueueNotification([], first, 2);
  queue = enqueueNotification(queue, second, 2);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].title, 'B');
  queue = enqueueNotification(queue, buildNotifyItem({ tone: 'success', title: 'C', message: '3', id: 'y' }, 3), 2);
  queue = enqueueNotification(queue, buildNotifyItem({ tone: 'success', title: 'D', message: '4', id: 'z' }, 4), 2);
  assert.equal(queue.length, 2);
  assert.deepEqual(queue.map((n) => n.id), ['y', 'z']);
});

test('dismiss removes by id', () => {
  const item = buildNotifyItem({ tone: 'warning', title: 'W', message: 'm', id: 'w1' });
  const queue = enqueueNotification([], item);
  assert.equal(dismissNotification(queue, 'w1').length, 0);
});
