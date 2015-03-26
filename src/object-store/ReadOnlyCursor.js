
import CursorDirection from "./CursorDirection"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  request: Symbol("request"),
  flags: Symbol("flags")
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
   */
  constructor(cursorRequest) {
    /**
     * The IndexedDB native request used to retrieve the native cursor. The
     * request is resolved, and will be used to retrieve the subsequent
     * cursors.
     *
     * @type {IDBRequest}
     */
    this[FIELDS.request] = cursorRequest

    /**
     * Cursor state flags.
     *
     * @type {Object<string, boolean>}
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
    if (!cursor) {
      direction = null
    } else if (cursor.direction.substring(0, 4) === "next") {
      direction = CursorDirection.NEXT
    } else {
      direction = CursorDirection.PREVIOUS
    }

    /**
     * Set to {@code true} if there are no more records available and the last
     * record has already been processed. All other fields of this cursor are
     * set to {@code null} in such a case.
     *
     * Set to {@code false} if the cursor has not finished traversing the
     * records or there is pointing to the last available record.
     *
     * @type {boolean}
     */
    this.done = !cursor

    /**
     * The direction in which this cursor is traversing the records.
     *
     * This field is {@code null} if the cursor has finished traversing the
     * records.
     *
     * @type {?CursorDirection}
     */
    this.direction = direction

    /**
     * Set to {@code true} if this cursor skips repeated key values, set to
     * {@code false} otherwise.
     *
     * This field is {@code null} if the cursor has finished traversing the
     * records.
     *
     * @type {?boolean}
     */
    this.unique = cursor ? (cursor.direction.indexOf("unique") > -1) : null

    /**
     * The key by which this cursor points to its current record. This is
     * either the primary key of the current record if the cursor is traversing
     * an object store, or value of the index key record field if the cursor is
     * traversing an index.
     *
     * This field is {@code null} if the cursor has finished traversing the
     * records.
     *
     * @type {?(number|string|Date|Array)}
     */
    this.key = cursor ? cursor.key : null

    /**
     * The primary key of the record this cursor points to. The field value is
     * always the same as the {@codelink key} field if the cursor is traversing
     * an object store.
     *
     * This field is {@code null} if the cursor has finished traversing the
     * records.
     *
     * @type {?(number|string|Date|Array)}
     */
    this.primaryKey = cursor ? cursor.primaryKey : null

    /**
     * The record this cursor points to. This field is {@code null} when the
     * cursor has finished traversing the records or has been opened as a key
     * cursor.
     *
     * @type {*}
     */
    this.record = cursor.value || null

    if (this.constructor === ReadOnlyCursor) {
      Object.freeze(this)
    }
  }

  /**
   * Advances the cursor the specified number of records forward.
   *
   * This cursor will remain unchanged after calling this method, the method
   * returns a promise that resolves to a new cursor pointing to the next
   * record.
   *
   * Repeated calls to this method on the same instance, or calling this method
   * after the {@codelink continue} method has been called, throw an error.
   *
   * Calling this method on a cursor that points after the last available
   * record in the sequence throws an error.
   *
   * @param {number=} stepsCount The number or records the cursor should
   *        advance, {@code 1} points to the immediate next record in the
   *        sequence of records the cursor traverses.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the next record.
   * @throw {Error} Thrown if the cursor is done traversing the record sequence
   *        or has already been used to retrieve the next record.
   */
  advance(stepsCount = 1) {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance has already advanced to another " +
          "record, use the new returned cursor")
    }
    if (this.done) {
      throw new Error("The cursor has already reached the end of the " +
          "records sequence")
    }

    return new Promise((resolve, reject) => {
      this[FIELDS.request].onsuccess = () => {
        resolve(new (this.constructor)(this[FIELDS.request]))
      }
      this[FIELDS.request].onerror = () => reject(this[FIELDS.request].error)

      this[FIELDS.request].resolve.advance(stepsCount)
      this[FIELDS.flags].hasAdvanced = true
    })
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
   * after the {@codelink advance} method has been called, throw an error.
   *
   * Calling this method on a cursor that points after the last available
   * record in the sequence throws an error.
   *
   * @param {(undefined|number|string|Date|Array)=} nextKey The next key to
   *        which the cursor should iterate. When set to {@code undefined}, the
   *        cursor will advance to the next record. Defaults to
   *        {@code undefined}.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the next record.
   * @throw {Error} Thrown if the cursor is done traversing the record sequence
   *        or has already been used to retrieve the next record.
   */
  continue(nextKey = undefined) {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance")
    }
    if (this.done) {
      throw new Error("The cursor has already reached the end of the " +
          "records sequence")
    }

    return new Promise((resolve, reject) => {
      this[FIELDS.request].onsuccess = () => {
        resolve(new this.constructor(this[FIELDS.request]))
      }
      this[FIELDS.request].onerror = () => reject(this[FIELDS.request].error)

      this[FIELDS.request].resolve.continue(nextKey)
      this[FIELDS.flags].hasAdvanced = true
    })
  }
}
