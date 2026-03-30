export type ORSetValue<T extends object> = Omit<T, '__uuidv7'> & {
  __uuidv7: string
}
export type ORSetAppendInput<T extends object> = Omit<
  ORSetValue<T>,
  '__uuidv7'
> &
  Partial<Pick<ORSetValue<T>, '__uuidv7'>>
export type ORSetState<T extends object> = {
  values: Record<string, Readonly<ORSetValue<T>>>
  tombstones: Set<string>
}
export type ORSetSnapshot<T extends object> = {
  values: Array<Readonly<ORSetValue<T>>>
  tombstones: Array<string>
}
export type ORSetDelta<T extends object> = {
  values: Array<Readonly<ORSetValue<T>>>
  tombstones: Array<string>
}
export type ORSetMergeResult<T extends object> = {
  removals: Array<string>
  additions: Array<Readonly<ORSetValue<T>>>
}

export type ORSetEventMap<T extends object> = {
  snapshot: ORSetSnapshot<T>
  delta: ORSetDelta<T>
  merge: ORSetMergeResult<T>
}

export type ORSetEventListener<
  T extends object,
  K extends keyof ORSetEventMap<T>,
> =
  | ((event: CustomEvent<ORSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ORSetEventMap<T>[K]>): void }

export type ORSetEventListenerFor<
  T extends object,
  K extends string,
> = K extends keyof ORSetEventMap<T>
  ? ORSetEventListener<T, K>
  : EventListenerOrEventListenerObject
