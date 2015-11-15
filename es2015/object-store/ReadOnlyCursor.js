
import PromiseSync from "../PromiseSync"
import CursorDirection from "./CursorDirection"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  request: Symbol("request"),
  flags: Symbol("flags"),
  iterationCallback: Symbol("iterationCallback")
})

/**
 * Cursor for traversing an object store or an index in the read-only mode.
 * Each instance points only to a single record and does not change state, the
 * instance creates a new instance to point to the next record in the sequence.
 */
export default class ReadOnlyCursor {
  /**
   * Initializes the cursor.
   *
   * @param {IDBRequest} cursorRequest The IndexedDB native request used to
   *        retrieve the native cursor. The request must already be resolved.
   * @param {function()} iterationCallback The callback to call when either the
   *        {@code advance} or the {@code continue} method is called. Repeated
   *        calls of this function must not have any effect.
   */
  constructor(cursorRequest, iterationCallback) {
    /**
     * The IndexedDB native request used to retrieve the native cursor. The
     * request is resolved, and will be used to retrieve the subsequent
     * cursors.
     *
     * @type {IDBRequest}
     */
    this[FIELDS.request] = cursorRequest
    
    /**
     * The callback to call when either the {@code advance} or the
     * {@code continue} method is called (the cursor is advanced to the next
     * record).
     * 
     * @type {function()}
     */
    this[FIELDS.iterationCallback] = iterationCallback

    /**
     * Cursor state flags.
     *
     * @type {{hasAdvanced: boolean}}
     */
    this[FIELDS.flags] = {
      /**
       * Set to {@code true} if this cursor has already been used to retrieve
       * the cursor pointing to the next record.
       *
       * @type {boolean}
       */
      hasAdvanced: false
    }

    let cursor = cursorRequest.result

    let direction
    if (cursor.direction.substring(0, 4) === "next") {
      direction = CursorDirection.NEXT
    } else {
      direction = CursorDirection.PREVIOUS
    }

    /**
     * The direction in which this cursor is traversing the records.
     *
     * @type {CursorDirection}
     */
    this.direction = direction

    /**
     * Set to {@code true} if this cursor skips repeated key values, set to
     * {@code false} otherwise.
     *
     * @type {boolean}
     */
    this.unique = cursor.direction.indexOf("unique") > -1

    /**
     * The key by which this cursor points to its current record. This is
     * either the primary key of the current record if the cursor is traversing
     * an object store, or value of the index key record field if the cursor is
     * traversing an index.
     *
     * @type {(number|string|Date|Array)}
     */
    this.key = cursor.key

    /**
     * The primary key of the record this cursor points to. The field value is
     * always the same as the {@linkcode key} field if the cursor is traversing
     * an object store.
     *
     * @type {(number|string|Date|Array)}
     */
    this.primaryKey = cursor.primaryKey

    if (this.constructor === ReadOnlyCursor) {
      Object.freeze(this)
    }
  }
  
  /**
   * The record this cursor points to. The returned value is {@code undefined}
   * if the cursor has been opened as a key cursor.
   *
   * @return {(undefined|*)} The record this cursor points to.
   */
  get record() {
    let cursor = this[FIELDS.request].result
    return cursor.value
  }

  /**
   * Advances the cursor the specified number of records forward.
   *
   * This cursor will remain unchanged after calling this method, the method
   * returns a promise that resolves to a new cursor pointing to the next
   * record.
   *
   * Repeated calls to this method on the same instance, or calling this method
   * after the {@linkcode continue} method has been called, throw an error.
   *
   * @param {number=} recordCount The number or records the cursor should
   *        advance, {@code 1} points to the immediate next record in the
   *        sequence of records the cursor traverses.
   * @throw {Error} Thrown if the cursor has already been used to iterate to
   *        the next record.
   */
  advance(recordCount = 1) {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance has already advanced to another " +
          "record")
    }

    let request = this[FIELDS.request]
    request.result.advance(recordCount)
    this[FIELDS.flags].hasAdvanced = true
    this[FIELDS.iterationCallback]()
  }

  /**
   * Continues to cursor, skipping all records until hitting the specified key.
   * If no key is provided, the method traverses to the key to the next key in
   * its direction.
   *
   * This cursor will remain unchanged after calling this method, the method
   * returns a promise that resolves to a new cursor pointing to the next
   * record.
   *
   * Repeated calls to this method on the same instance, or calling this method
   * after the {@linkcode advance} method has been called, throw an error.
   *
   * @param {(undefined|number|string|Date|Array)=} nextKey The next key to
   *        which the cursor should iterate. When set to {@code undefined}, the
   *        cursor will advance to the next record. Defaults to
   *        {@code undefined}.
   * @throw {Error} Thrown if the cursor has already been used to iterate to
   *        the next record.
   */
  continue(nextKey = undefined) {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance has already advanced to another " +
          "record")
    }

    let request = this[FIELDS.request]
    request.result.continue(nextKey)
    this[FIELDS.flags].hasAdvanced = true
    this[FIELDS.iterationCallback]()
  }
}
