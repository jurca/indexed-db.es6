
import ReadOnlyCursor from "./ReadOnlyCursor"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  cursor: Symbol("cursor")
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
   */
  constructor(cursorRequest) {
    super(cursorRequest)

    /**
     * The native cursor.
     * 
     * @type {IDBCursor}
     */
    this[FIELDS.cursor] = cursorRequest.result
  }

  /**
   * Sets the record at the current position of this cursor.
   *
   * If the cursor points to a record that has just been deleted, a new record
   * is created.
   *
   * @param {*} record The new record to set at the current position.
   * @return {Promise<(number|string|Date|Array)>} A promise that resolves to
   *         the primary key of the record when the operation has been
   *         successfully queued.
   */
  update(record) {
    let request = this[FIELDS.cursor].update(record)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(request.error)
    })
  }

  /**
   * Deletes the record at the current position of this cursor.
   *
   * @return {Promise<undefined>} A promise that resolves when the record is
   *         deleted.
   */
  delete() {
    let request = this[FIELDS.cursor].delete()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(request.error)
    })
  }
}
