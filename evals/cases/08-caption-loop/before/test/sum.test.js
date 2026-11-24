import test from 'node:test'
import assert from 'node:assert/strict'

import { sum } from '../src/sum.js'

test('sums numbers', () => {
  assert.equal(sum([1, 2]), 3)
})

test('an empty list is zero', () => {
  assert.equal(sum([]), 0)
})

test('coerces numeric strings', () => {
  assert.equal(sum([1, '2']), 3)
})

test('rejects non-numeric text', () => {
  assert.throws(() => sum(['a']), /not a number/)
})

test('does not coerce booleans', () => {
  assert.throws(() => sum([true]), /not a number/)
})
