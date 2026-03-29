export type ORSetEntry<T> = Omit<T, '__uuidv7'> & { __uuidv7: string }
export type ORSetAppendInput<T> = Omit<ORSetEntry<T>, '__uuidv7'> &
  Partial<Pick<ORSetEntry<T>, '__uuidv7'>>
export type ORSetState<T> = {
  items: Record<string, Readonly<ORSetEntry<T>>>
  tombs: Set<string>
}
export type ORSetSnapshot<T> = {
  items: Array<Readonly<ORSetEntry<T>>>
  tombs: Array<string>
}
export type ORSetMergeResult<T> = {
  removals: Array<string>
  additions: Array<Readonly<ORSetEntry<T>>>
}

export type ORSetEventMap<T> = {
  snapshot: ORSetSnapshot<T>
  delta: ORSetSnapshot<T>
  merge: ORSetMergeResult<T>
}

export type ORSetEventListener<T, K extends keyof ORSetEventMap<T>> =
  | ((event: CustomEvent<ORSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ORSetEventMap<T>[K]>): void }

export type ORSetEventListenerFor<
  T,
  K extends string,
> = K extends keyof ORSetEventMap<T>
  ? ORSetEventListener<T, K>
  : EventListenerOrEventListenerObject
