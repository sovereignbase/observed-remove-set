import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  assertBadSnapshotError,
  getORSetErrorConstructor,
} from '../shared/orset.mjs'

test('constructor malformed snapshot errors expose code name and explicit message', () => {
  assert.throws(
    () => new ORSet({ items: 'bad', tombs: [] }),
    (error) => {
      assertBadSnapshotError(error)
      assert.match(error.message, /Malformed snapshot\./)
      return true
    }
  )
})

test('merge malformed snapshot errors expose code name and explicit message', () => {
  const set = new ORSet()

  assert.throws(
    () => set.merge({ items: [], tombs: 'bad' }),
    (error) => {
      assertBadSnapshotError(error)
      assert.match(error.message, /Malformed snapshot\./)
      return true
    }
  )
})

test('captured ORSetError constructor falls back to the code when message is omitted', () => {
  const ORSetError = getORSetErrorConstructor()
  const error = new ORSetError('BAD_SNAPSHOT')

  assert.equal(error.code, 'BAD_SNAPSHOT')
  assert.equal(error.name, 'ORSetError')
  assert.match(error.message, /BAD_SNAPSHOT/)
})
