import assert from 'node:assert/strict';
import test from 'node:test';
import { isRevokedAuthError, resolveAuthAccess } from './authSession';

const user = { uid: 'u1' };
const active = { active: true };
const locked = { active: false };

test('resolveAuthAccess waits for auth and for the first profile snapshot', () => {
  assert.equal(resolveAuthAccess({ authReady: false, user: null, profile: null, profileResolved: false, profileError: false }), 'loading');
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: null, profileResolved: false, profileError: false }), 'loading');
  assert.equal(resolveAuthAccess({ authReady: true, user: null, profile: null, profileResolved: false, profileError: false }), 'login');
});

test('an active profile is ready, and a confirmed missing or inactive profile is blocked', () => {
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: active, profileResolved: true, profileError: false }), 'ready');
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: locked, profileResolved: true, profileError: false }), 'blocked');
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: null, profileResolved: true, profileError: false }), 'blocked');
});

test('a profile listener error does not log the user out or lock the account', () => {
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: null, profileResolved: false, profileError: true }), 'profile_unavailable');
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: active, profileResolved: true, profileError: true }), 'ready');
  assert.equal(resolveAuthAccess({ authReady: true, user, profile: locked, profileResolved: true, profileError: true }), 'blocked');
});

test('isRevokedAuthError is true only for disabled, missing, or revoked accounts', () => {
  assert.equal(isRevokedAuthError('auth/user-disabled'), true);
  assert.equal(isRevokedAuthError('user-not-found'), true);
  assert.equal(isRevokedAuthError('auth/user-token-expired'), true);
  assert.equal(isRevokedAuthError('invalid-user-token'), true);
  assert.equal(isRevokedAuthError('auth/network-request-failed'), false);
  assert.equal(isRevokedAuthError('permission-denied'), false);
  assert.equal(isRevokedAuthError('unauthenticated'), false);
  assert.equal(isRevokedAuthError('auth/too-many-requests'), false);
  assert.equal(isRevokedAuthError(''), false);
  assert.equal(isRevokedAuthError(undefined), false);
});
