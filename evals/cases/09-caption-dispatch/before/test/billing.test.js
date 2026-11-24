import test from 'node:test'
import assert from 'node:assert/strict'

import { roundCents } from '../src/billing/invoice.js'
import { fixtures } from './shared.js'

test('rounds down below a half cent', () => {
  assert.equal(roundCents(1.234), 1.23)
})

test('rounds up at a half cent', () => {
  assert.equal(roundCents(fixtures.amount), 1.24)
})
