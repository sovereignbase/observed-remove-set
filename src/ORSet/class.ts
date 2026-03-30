import { v7 as uuidv7, version as uuidVersion } from 'uuid'
import type {
  ORSetAppendInput,
  ORSetEventListenerFor,
  ORSetValue,
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
    this.state = { values: {}, tombstones: new Set([]) }
    if (snapshot !== undefined) {
      if (!validateORSetSnapshot(snapshot)) {
        throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }
      for (const tombstone of snapshot.tombstones) {
        if (!this.isUuidV7(tombstone)) continue
        this.state.tombstones.add(tombstone)
      }
      for (const value of snapshot.values) {
        const v7 = value.__uuidv7
        if (!this.isUuidV7(v7)) continue
        if (
          !this.state.tombstones.has(v7) &&
          !Object.hasOwn(this.state.values, v7)
        ) {
          this.state.values[v7] = Object.freeze(value)
          this.size++
        }
      }
    }
  }
  /***/
  has(value: ORSetValue<T>): boolean {
    return Object.hasOwn(this.state.values, value.__uuidv7)
  }
  /***/
  append(value: ORSetAppendInput<T>): void {
    const v7 = value.__uuidv7 as string | undefined
    if (this.isUuidV7(v7) && Object.hasOwn(this.state.values, v7)) return

    const frozenValue = Object.freeze(
      this.isUuidV7(v7) && !this.state.tombstones.has(v7)
        ? (value as unknown as ORSetValue<T>)
        : ({ ...value, __uuidv7: uuidv7() } as ORSetValue<T>)
    )
    const nextV7 = frozenValue.__uuidv7
    this.state.values[nextV7] = frozenValue
    this.size++
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombstones: [],
          values: [frozenValue],
        },
      })
    )
  }
  /***/
  clear(): void {
    if (this.size === 0) return
    const egressTombstones = []
    for (const v7 of Object.keys(this.state.values)) {
      this.state.tombstones.add(v7)
      delete this.state.values[v7]
      egressTombstones.push(v7)
    }
    this.size = 0
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombstones: egressTombstones,
          values: [],
        },
      })
    )
  }
  /***/
  remove(value: ORSetValue<T> | string): void {
    const v7 = typeof value === 'string' ? value : value.__uuidv7
    if (!this.isUuidV7(v7)) return
    const hadItem = Object.hasOwn(this.state.values, v7)
    const hadTombstone = this.state.tombstones.has(v7)
    if (!hadItem && hadTombstone) return
    this.state.tombstones.add(v7)
    delete this.state.values[v7]
    if (hadItem) this.size--
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('delta', {
        detail: {
          tombstones: [v7],
          values: [],
        },
      })
    )
  }
  /***/
  values(): Array<Readonly<ORSetValue<T>>> {
    return Object.values(this.state.values)
  }
  /***/
  tombstones(): Set<string> {
    return this.state.tombstones
  }
  /***/
  merge(ingress: ORSetSnapshot<T>) {
    const additions: Array<Readonly<ORSetValue<T>>> = []
    const removals: Array<string> = []
    if (!validateORSetSnapshot(ingress)) {
      throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    for (const tombstone of ingress.tombstones) {
      if (this.state.tombstones.has(tombstone)) continue
      if (!this.isUuidV7(tombstone)) continue
      const hadItem = Object.hasOwn(this.state.values, tombstone)
      this.state.tombstones.add(tombstone)
      delete this.state.values[tombstone]
      if (hadItem) this.size--
      removals.push(tombstone)
    }
    for (const value of ingress.values) {
      const v7 = value.__uuidv7
      if (!this.isUuidV7(v7)) continue
      if (
        !this.state.tombstones.has(v7) &&
        !Object.hasOwn(this.state.values, v7)
      ) {
        this.state.values[v7] = Object.freeze(value)
        this.size++
        additions.push(value)
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
  }
  /***/
  snapshot(): void {
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: {
          values: Object.values(this.state.values),
          tombstones: Array.from(this.state.tombstones.values()),
        },
      })
    )
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
