
/**
 * An alternative to using the {@codelink IDBKeyRange} native class directly or
 * a viable option if the documentation is needed at hand.
 *
 * The {@codelink KeyRange} class is used to construct {@codelink IDBKeyRange}
 * instances. The {@codelink IDBKeyRange} instances are used to represent the
 * ranges of values used to filter the records when traversing an object store
 * or an index.
 */
export default class KeyRange {
  /**
   * Throws an error, because the {@codelink KeyRange} class is static.
   */
  constructor() {
    throw new Error("The KeyRange class is static, no instances can be " +
        "created")
  }

  /**
   * Creates a new key range matching value greater than (or, if specified,
   * equal to) the specified lower bound, and lower than (or, if specified,
   * equal to) the specified upper bound.
   *
   * @param {(number|string|Date|Array)} lower The lower bound. Must be a valid
   *        key.
   * @param {(number|string|Date|Array)} upper The upper bound. Must be a valid
   *        key.
   * @param {boolean=} lowerOpen If {@code true}, the lower bound will not be
   *        matched by the created key range. Defaults to {@code false}.
   * @param {boolean=} upperOpen If {@code true}, the upper bound will not be
   *        matched by the created key range. Defaults to {@code false}.
   */
  static bound(lower, upper, lowerOpen = false, upperOpen = false) {
    return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
  }

  /**
   * Creates a new key range matching values greater than (or, if specified,
   * equal to) the specified value.
   *
   * @param {(number|string|Date|Array)} bound The value to match. Must be a
   *        valid key.
   * @param {boolean=} open If {@code true}, the value will not be matched by
   *        the created key range. Defaults to {@code false}.
   * @return {IDBKeyRange} The created key range.
   */
  static lowerBound(bound, open = false) {
    return IDBKeyRange.lowerBound(bound, open)
  }

  /**
   * Creates a new key range matching values lower than (or, if specified,
   * equal to) the specified value.
   *
   * @param {(number|string|Date|Array)} bound The value to match. Must be a
   *        valid key.
   * @param {boolean=} open If {@code true}, the value will not be matched by
   *        the created key range. Defaults to {@code false}.
   * @return {IDBKeyRange} The created key range.
   */
  static upperBound(bound, open = false) {
    return IDBKeyRange.upperBound(bound, open)
  }

  /**
   * Creates a new key range matching a single key value.
   *
   * @param {(number|string|Date|Array)} expectedValue The value to match. Must
   *        be a valid key.
   * @return {IDBKeyRange} The created key range.
   */
  static only(expectedValue) {
    return IDBKeyRange.only(expectedValue)
  }
}
