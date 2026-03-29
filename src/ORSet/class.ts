import { v7 as uuidv7, version as uuidVersion } from 'uuid'
import type {
  ORSetAppendInput,
  ORSetEventListenerFor,
  ORSetEntry,
  ORSetMergeResult,
  ORSetSnapshot,
  ORSetState,
} from '../.types/index.js'
import { ORSetError } from '../.errors/class.js'
import { validateORSetSnapshot } from './validateORSetSnapshot/index.js'

export class ORSet<T> {
  private readonly eventTarget = new EventTarget()
  private readonly state: ORSetState<T>
  public size: number
  /***/
  constructor(snapshot?: ORSetSnapshot<T>) {
    this.size = 0
    this.state = { items: {}, tombs: new Set([]) }
    if (snapshot !== undefined) {
      if (!validateORSetSnapshot(snapshot)) {
        throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }
      for (const tomb of snapshot.tombs) {
        if (!this.isUuidV7(tomb)) continue
        this.state.tombs.add(tomb)
      }
      for (const item of snapshot.items) {
        const v7 = item.__uuidv7
        if (!this.isUuidV7(v7)) continue
        if (!this.state.tombs.has(v7) && !Object.hasOwn(this.state.items, v7)) {
          this.state.items[v7] = Object.freeze(item)
          this.size++
        }
      }
    }
  }
  /***/
  has(value: ORSetEntry<T>): boolean {
    return Object.hasOwn(this.state.items, value.__uuidv7)
  }
  /***/
  append(entry: ORSetAppendInput<T>): void {
    const v7 = entry.__uuidv7 as string | undefined
    if (this.isUuidV7(v7) && Object.hasOwn(this.state.items, v7)) return

    const frozenEntry = Object.freeze(
      this.isUuidV7(v7) && !this.state.tombs.has(v7)
        ? (entry as unknown as ORSetEntry<T>)
        : ({ ...entry, __uuidv7: uuidv7() } as ORSetEntry<T>)
    )
    const nextV7 = frozenEntry.__uuidv7
    this.state.items[nextV7] = frozenEntry
    this.size++
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombs: [],
          items: [frozenEntry],
        },
      })
    )
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: this.snapshot(),
      })
    )
  }
  /***/
  clear(): void {
    if (this.size === 0) return
    const egressTombs = []
    for (const v7 of Object.keys(this.state.items)) {
      this.state.tombs.add(v7)
      delete this.state.items[v7]
      egressTombs.push(v7)
    }
    this.size = 0
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombs: egressTombs,
          items: [],
        },
      })
    )
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: this.snapshot(),
      })
    )
  }
  /***/
  remove(entry: ORSetEntry<T>): void {
    const v7 = entry.__uuidv7
    if (!this.isUuidV7(v7)) return
    const hadItem = Object.hasOwn(this.state.items, v7)
    const hadTomb = this.state.tombs.has(v7)
    if (!hadItem && hadTomb) return
    this.state.tombs.add(v7)
    delete this.state.items[v7]
    if (hadItem) this.size--
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombs: [v7],
          items: [],
        },
      })
    )
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: this.snapshot(),
      })
    )
  }
  /***/
  values(): Array<Readonly<ORSetEntry<T>>> {
    return Object.values(this.state.items)
  }
  /***/
  tombstones(): Set<string> {
    return this.state.tombs
  }
  /***/
  merge(ingress: ORSetSnapshot<T>) {
    const additions: Array<Readonly<ORSetEntry<T>>> = []
    const removals: Array<string> = []
    if (!validateORSetSnapshot(ingress)) {
      throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    for (const tomb of ingress.tombs) {
      if (this.state.tombs.has(tomb)) continue
      if (!this.isUuidV7(tomb)) continue
      const hadItem = Object.hasOwn(this.state.items, tomb)
      this.state.tombs.add(tomb)
      delete this.state.items[tomb]
      if (hadItem) this.size--
      removals.push(tomb)
    }
    for (const entry of ingress.items) {
      const v7 = entry.__uuidv7
      if (!this.isUuidV7(v7)) continue
      if (!this.state.tombs.has(v7) && !Object.hasOwn(this.state.items, v7)) {
        this.state.items[v7] = Object.freeze(entry)
        this.size++
        additions.push(entry)
      }
    }
    if (additions.length === 0 && removals.length === 0) return
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetMergeResult<T>>('merge', {
        detail: {
          additions,
          removals,
        },
      })
    )
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: this.snapshot(),
      })
    )
  }
  /***/
  snapshot(): ORSetSnapshot<T> {
    return {
      items: Object.values(this.state.items),
      tombs: Array.from(this.state.tombs.values()),
    }
  }
  /***/
  addEventListener<K extends string>(
    type: K,
    listener: ORSetEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
  /***/
  removeEventListener<K extends string>(
    type: K,
    listener: ORSetEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
  /***/
  private isUuidV7(value: unknown): value is string {
    if (typeof value !== 'string') return false
    try {
      return uuidVersion(value) === 7
    } catch {
      return false
    }
  }
}
