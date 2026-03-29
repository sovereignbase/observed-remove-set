export async function runBrowserSuite(page, origin) {
  await page.goto(`${origin}/test/e2e/runsInBrowsers/index.html`)

  await page.evaluate(async () => {
    const assert = (condition, message) => {
      if (!condition) throw new Error(message)
    }

    const { ORSet } = await import('/dist/index.js')

    const set = new ORSet()
    let delta = 0
    let snapshot = 0

    set.addEventListener('delta', () => {
      delta++
    })
    set.addEventListener('snapshot', () => {
      snapshot++
    })

    set.append({ name: 'alice' })
    const [stored] = set.values()

    assert(typeof stored.__uuidv7 === 'string', 'append should assign uuid')
    assert(set.size === 1, 'append should grow set')
    assert(
      delta === 1 && snapshot === 1,
      'append should emit delta and snapshot'
    )

    set.append(stored)
    assert(set.size === 1, 'duplicate append should be a no-op')
    assert(delta === 1 && snapshot === 1, 'duplicate append should not emit')

    set.clear()
    assert(set.size === 0, 'clear should empty the set')
    assert(delta === 2 && snapshot === 2, 'clear should emit once')

    set.clear()
    assert(delta === 2 && snapshot === 2, 'empty clear should stay silent')

    const replica = new ORSet()
    let merge = 0
    let replicaSnapshots = 0

    replica.addEventListener('merge', () => {
      merge++
    })
    replica.addEventListener('snapshot', () => {
      replicaSnapshots++
    })

    set.append({ name: 'bob' })
    replica.merge(set.snapshot())

    assert(replica.size === 1, 'merge should import valid item')
    assert(merge === 1 && replicaSnapshots === 1, 'merge should emit once')

    replica.merge({
      items: [{ __uuidv7: 'bad', name: 'invalid' }],
      tombs: ['bad'],
    })

    assert(
      merge === 1 && replicaSnapshots === 1,
      'invalid no-op merge stays silent'
    )

    let malformedThrew = false
    try {
      new ORSet(123)
    } catch (error) {
      malformedThrew =
        error?.name === 'ORSetError' && error?.code === 'BAD_SNAPSHOT'
    }

    assert(malformedThrew, 'malformed snapshot should throw ORSetError')

    const [bob] = replica.values()
    let removeDelta = 0

    replica.addEventListener('delta', () => {
      removeDelta++
    })

    replica.remove(bob)
    replica.remove(bob)

    assert(removeDelta === 1, 'repeated remove should be a no-op')
  })
}
