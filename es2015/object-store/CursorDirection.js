
/**
 * Enum specifying the possible direction in which a cursor will traverse the
 * keys in its source.
 *
 * @enum {CursorDirection}
 */
export default class CursorDirection {
  /**
   * Initialized the enum constant.
   * 
   * @param {string} value The name of the enum constant being created.
   */
  constructor(value) {
    /**
     * The native value representing this enum constant, equal to the constant
     * name.
     * 
     * @type {string}
     */
    this.value = value;
    
    Object.freeze(this);
  }
  
  /**
   * Causes the cursor to be opened at the start of the source. When iterated,
   * the cursor will yield records in monotonically increasing order of keys.
   *
   * @return {CursorDirection} Enum constant for iterating a cursor through
   *         the records in the ascending order of keys.
   */
  static get NEXT() {
    return NEXT
  }

  /**
   * Causes the cursor to be opened at the end of the source. When iterated,
   * the cursor will yield records in monotonically decreasing order of keys.
   *
   * @return {CursorDirection} Enum constant for iterating a cursor through
   *         the records in the descending order of keys.
   */
  static get PREVIOUS() {
    return PREVIOUS
  }
}

/**
 * The enum constant available as {@linkcode CursorDirection.NEXT}.
 * 
 * @type {CursorDirection}
 */
export const NEXT = new CursorDirection("NEXT")

/**
 * The enum constant available as {@linkcode CursorDirection.PREVIOUS}.
 * 
 * @type {CursorDirection}
 */
export const PREVIOUS = new CursorDirection("PREVIOUS")

Object.freeze(CursorDirection)
