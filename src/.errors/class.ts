/** Enumerates explicit OR-Set error codes. */
export type ORSetErrorCode = 'BAD_SNAPSHOT'

/** Represents an explicit OR-Set error. */
export class ORSetError extends Error {
  readonly code: ORSetErrorCode

  /**
   * Creates a new OR-Set error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail.
   */
  constructor(code: ORSetErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/observed-remove-set} ${detail}`)
    this.code = code
    this.name = 'ORSetError'
  }
}
