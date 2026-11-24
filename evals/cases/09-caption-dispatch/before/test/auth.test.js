import test from 'node:test'
import assert from 'node:assert/strict'

import { isExpired } from '../src/auth/login.js'
import { fixtures } from './shared.js'

test('a token is valid before its expiry', () => {
  assert.equal(isExpired(1_000, 999), false)
})

test('a token expires exactly at its expiry', () => {
  assert.equal(isExpired(fixtures.token.expiresAt, fixtures.token.expiresAt), true)
})

test('a token is expired after its expiry', () => {
  assert.equal(isExpired(1_000, 1_001), true)
})
