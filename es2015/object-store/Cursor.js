
import PromiseSync from "../PromiseSync.js"
import ReadOnlyCursor from "./ReadOnlyCursor.js"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  cursor: Symbol("cursor"),
  iterationCallback: Symbol("iterationCallback"),
  suboperationCallback: Symbol("suboperationCallback"),
  suboperationPromise: Symbol("suboperationPromise"),
  flags: Symbol("flags")
})

/**
 * Read-write cursor for traversing object stores and indexes and modifying or
 * deleting the records on-the-fly.
 */
export default class Cursor extends ReadOnlyCursor {
  /**
   * Initializes the cursor.
   *
   * @param {IDBRequest} cursorRequest The IndexedDB native request used to
   *        retrieve the native cursor. The request must already be resolved.
   * @param {function()} iterationCallback The Callback to call when either the
   *        {@code advance} or the {@code continue} method is called. Repeated
   *        calls of this function must not have any effect.
   * @param {function(IDBRequest): PromiseSync} suboperationCallback The
   *        callback to execute when a sub-operation (record modification or
   *        deletion) is requested. The callback returns a synchronous promise
   *        resolved when the provided Indexed DB request is completed.
   */
  constructor(cursorRequest, iterationCallback, suboperationCallback) {
    super(cursorRequest, () => {})

    /**
     * The native cursor.
     * 
     * @type {IDBCursor}
     */
    this[FIELDS.cursor] = cursorRequest.result
    
    /**
     * The Callback to call when either the {@code advance} or the
     * {@code continue} method is called.
     * 
     * @type {function()}
     */
    this[FIELDS.iterationCallback] = iterationCallback
    
    /**
     * The callback to execute when a sub-operation (record modification or
     * deletion) is requested. The callback returns a synchronous promise
     * resolved when the provided Indexed DB request is completed.
     * 
     * @type {function(IDBRequest): PromiseSync}
     */
    this[FIELDS.suboperationCallback] = suboperationCallback
    
    /**
     * Promise that resolves when all pending sub-operations on the current
     * record are completed.
     * 
     * @type {PromiseSync<undefined>
     */
    this[FIELDS.suboperationPromise] = PromiseSync.resolve()
    
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
  }

  /**
   * Sets the record at the current position of this cursor.
   *
   * If the cursor points to a record that has just been deleted, a new record
   * is created.
   * 
   * Calling this method will delay the effect of the {@code advance} and the
   * {@code continue} methods until the operation has been successfully queued.
   *
   * @param {*} record The new record to set at the current position.
   * @return {Promise<(number|string|Date|Array)>} A promise that resolves to
   *         the primary key of the record when the operation has been
   *         successfully queued.
   */
  update(record) {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance has already advanced to another " +
          "record")
    }
    
    let request = this[FIELDS.cursor].update(record)
    let operationPromise = this[FIELDS.suboperationCallback](request)
    this[FIELDS.suboperationPromise] =
        this[FIELDS.suboperationPromise].then(() => operationPromise)
    
    return operationPromise
  }

  /**
   * Deletes the record at the current position of this cursor.
   * 
   * Calling this method will delay the effect of the {@code advance} and the
   * {@code continue} methods until the operation has been successfully queued.
   *
   * @return {Promise<undefined>} A promise that resolves when the record is
   *         deleted.
   */
  delete() {
    if (this[FIELDS.flags].hasAdvanced) {
      throw new Error("This cursor instance has already advanced to another " +
          "record")
    }
    
    let request = this[FIELDS.cursor].delete()
    let operationPromise = this[FIELDS.suboperationCallback](request)
    this[FIELDS.suboperationPromise] =
        this[FIELDS.suboperationPromise].then(() => operationPromise)
    
    return operationPromise
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
   * @override
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
    
    this[FIELDS.flags].hasAdvanced = true
    
    this[FIELDS.suboperationPromise].then(() => super.advance(recordCount))
    
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
    
    this[FIELDS.flags].hasAdvanced = true
    
    this[FIELDS.suboperationPromise].then(() => super.continue(nextKey))
    
    this[FIELDS.iterationCallback]()
  }
}
