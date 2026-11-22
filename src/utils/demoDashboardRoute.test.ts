import assert from 'node:assert/strict';
import test from 'node:test';
import { isDemoDashboardLocation } from './demoDashboardRoute';

const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

test('recognizes the demo dashboard path, query, and hash URLs', () => {
  assert.equal(isDemoDashboardLocation(loc('/demo-dashboard')), true);
  assert.equal(isDemoDashboardLocation(loc('/demo-dashboard/')), true);
  assert.equal(isDemoDashboardLocation(loc('/', '?demo=dashboard')), true);
  assert.equal(isDemoDashboardLocation(loc('/', '', '#/demo-dashboard')), true);
  assert.equal(isDemoDashboardLocation(loc('/', '', '#demo=dashboard')), true);
  assert.equal(isDemoDashboardLocation(loc('/')), false);
  assert.equal(isDemoDashboardLocation(loc('/orders', '?tab=dashboard')), false);
});
