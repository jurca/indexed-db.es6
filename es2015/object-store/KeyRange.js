
/**
 * An alternative to using the {@linkcode IDBKeyRange} native class directly or
 * a viable option if the documentation is needed at hand.
 *
 * The {@linkcode KeyRange} class is used to construct {@linkcode IDBKeyRange}
 * instances. The {@linkcode IDBKeyRange} instances are used to represent the
 * ranges of values used to filter the records when traversing an object store
 * or an index.
 */
export default class KeyRange {
  /**
   * Throws an error, because the {@linkcode KeyRange} class is static.
   */
  constructor() {
    throw new Error("The KeyRange class is static, no instances can be " +
        "created")
  }

  /**
   * Converts the provided array into a key range. The following array
   * structures are supported:
   *
   * - {@code (undefined|null), key value, (optional) open range: boolean} will
   *   be converted to an upper-bound key range with the specified key value as
   *   the upper bound.
   * - {@code (optional) open range: boolean, key value, (undefined|null)} will
   *   be converted to a lower-bound key range with the specified key value as
   *   the lower bound.
   * - {@code (optional) lower open: boolean, lower bound, upper bound,
   *   (optional) upper open: boolean} will be converted to a bound key range
   *   with the specified lower and upper bound.
   *
   * A key value / range bound must always be a {@code number}, {@code string},
   * {@code Date} or an {@code Array} of valid key value (therefore a valid
   * IndexedDB key).
   *
   * To create a single-value key range, use the {@linkcode only} method.
   *
   * @param {...(boolean|null|undefined|number|string|Date|Array)} rangeSpec
   *        The array representing the key range to generate.
   * @return {IDBKeyRange} The created IndexedDB key range.
   * @throws {Error} Thrown if the range array is invalid.
   */
  static from(...rangeSpec) {
    let lowerOpenSpecified = true
    let upperOpenSpecified = true

    if (typeof rangeSpec[0] !== "boolean") {
      rangeSpec.unshift(false)
      lowerOpenSpecified = false
    }
    if (typeof rangeSpec[rangeSpec.length - 1] !== "boolean") {
      rangeSpec.push(false)
      upperOpenSpecified = false
    }

    if (rangeSpec.length !== 4) {
      throw new Error(`Invalid range array, ${rangeSpec} was provided`)
    }

    for (let i = 1; i < 3; i++) {
      if (rangeSpec[i] === null) {
        rangeSpec[i] = undefined
      }
    }

    if ((rangeSpec[1] === undefined) && !lowerOpenSpecified) {
      return KeyRange.upperBound(rangeSpec[2], rangeSpec[3])
    }

    if ((rangeSpec[2] === undefined) && !upperOpenSpecified) {
      return KeyRange.lowerBound(rangeSpec[1], rangeSpec[0])
    }

    if (rangeSpec.slice(1, 3).every(value => value === undefined)) {
      throw new Error(`Invalid range array, ${rangeArray} was provided`)
    }

    return KeyRange.bound(
      rangeSpec[1],
      rangeSpec[2],
      rangeSpec[0],
      rangeSpec[3]
    )
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

/**
 * A short-hand for {@code KeyRange.from()}, converts the provided array into a
 * key range. The following array structures are supported:
 *
 * - {@code (undefined|null), key value, (optional) open range: boolean} will
 *   be converted to an upper-bound key range with the specified key value as
 *   the upper bound.
 * - {@code (optional) open range: boolean, key value, (undefined|null)} will
 *   be converted to a lower-bound key range with the specified key value as
 *   the lower bound.
 * - {@code (optional) lower open: boolean, lower bound, upper bound,
   *   (optional) upper open: boolean} will be converted to a bound key range
 *   with the specified lower and upper bound.
 *
 * A key value / range bound must always be a {@code number}, {@code string},
 * {@code Date} or an {@code Array} of valid key value (therefore a valid
 * IndexedDB key).
 *
 * To create a single-value key range, use the {@linkcode KeyRange.only}
 * method.
 *
 * @param {...(boolean|null|undefined|number|string|Date|Array)} rangeSpec
 *        The array representing the key range to generate.
 * @return {IDBKeyRange} The created IndexedDB key range.
 * @throws {Error} Thrown if the range array is invalid.
 */
export function range(...rangeSpec) {
  return KeyRange.from(...rangeSpec)
}
