import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'

test('event listener object handleEvent receives delta detail', () => {
  const set = new ORSet()
  let detail

  set.addEventListener('delta', {
    handleEvent(event) {
      detail = event.detail
    },
  })

  set.append({ name: 'alice' })

  assert.equal(detail.items.length, 1)
  assert.equal(detail.tombs.length, 0)
})

test('removeEventListener stops a function listener', () => {
  const set = new ORSet()
  let calls = 0
  const listener = () => {
    calls++
  }

  set.addEventListener('delta', listener)
  set.removeEventListener('delta', listener)
  set.append({ name: 'alice' })

  assert.equal(calls, 0)
})

test('removeEventListener stops an object listener', () => {
  const set = new ORSet()
  let calls = 0
  const listener = {
    handleEvent() {
      calls++
    },
  }

  set.addEventListener('snapshot', listener)
  set.removeEventListener('snapshot', listener)
  set.append({ name: 'alice' })

  assert.equal(calls, 0)
})

test('event channels remain independent across append remove clear and merge', () => {
  const local = new ORSet()
  const remote = new ORSet()
  const counts = { delta: 0, snapshot: 0, merge: 0 }

  local.addEventListener('delta', () => {
    counts.delta++
  })
  local.addEventListener('snapshot', () => {
    counts.snapshot++
  })
  local.addEventListener('merge', () => {
    counts.merge++
  })

  local.append({ name: 'alice' })
  const [alice] = local.values()
  local.remove(alice)
  local.clear()
  remote.append({ name: 'bob' })
  local.merge(remote.snapshot())

  assert.deepEqual(counts, {
    delta: 2,
    snapshot: 3,
    merge: 1,
  })
})

test('snapshot listeners observe the latest state after each mutation', () => {
  const local = new ORSet()
  const remote = new ORSet()
  const seenSizes = []

  local.addEventListener('snapshot', (event) => {
    seenSizes.push(event.detail.items.length)
  })

  local.append({ name: 'alice' })
  const [alice] = local.values()
  local.remove(alice)
  remote.append({ name: 'bob' })
  local.merge(remote.snapshot())

  assert.deepEqual(seenSizes, [1, 0, 1])
})
