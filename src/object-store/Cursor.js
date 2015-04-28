
import ReadOnlyCursor from "./ReadOnlyCursor"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  cursor: Symbol("cursor"),
  requestMonitor: Symbol("requestMonitor")
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
   * @param {RequestMonitor} requestMonitor The request monitor used to monitor
   *        the status of pending database operation requests.
   */
  constructor(cursorRequest, requestMonitor) {
    super(cursorRequest, requestMonitor)

    /**
     * The native cursor.
     * 
     * @type {IDBCursor}
     */
    this[FIELDS.cursor] = cursorRequest.result
    
    /**
     * The request monitor used to monitor the status of pending database
     * operation requests.
     * 
     * @type {RequestMonitor}
     */
    this[FIELDS.requestMonitor] = requestMonitor
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
    return this[FIELDS.requestMonitor].monitor(request)
  }

  /**
   * Deletes the record at the current position of this cursor.
   *
   * @return {Promise<undefined>} A promise that resolves when the record is
   *         deleted.
   */
  delete() {
    return this[FIELDS.requestMonitor].monitor(this[FIELDS.cursor].delete())
  }
}
