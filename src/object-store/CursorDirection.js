
import Enum from "typed-enum"

/**
 * Enum specifying the possible direction in which a cursor should traverse the
 * keys in its source.
 *
 * @type {CursorDirection}
 */
export default Enum (
  /**
   * Causes the cursor to be opened at the start of the source. When iterated,
   * the cursor will yield records in monotonically decreasing order of keys.
   *
   * @type {CursorDirection}
   */
  "NEXT",

  /**
   * Causes the cursor to be opened at the end of the source. When iterated,
   * the cursor will yield records in monotonically decreasing order of keys.
   *
   * @type {CursorDirection}
   */
  "PREVIOUS"
)
