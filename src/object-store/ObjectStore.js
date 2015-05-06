
import PromiseSync from "../PromiseSync"
import ReadOnlyObjectStore from "./ReadOnlyObjectStore"
import Cursor from "./Cursor"
import CursorDirection from "./CursorDirection"
import Index from "./Index"
import {normalizeFilter} from "./utils"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  objectStore: Symbol("objectStore"),
  indexes: Symbol("indexes"),
  transactionFactory: Symbol("transactionFactory")
})

/**
 * Read-write object store accessor.
 */
export default class ObjectStore extends ReadOnlyObjectStore {
  /**
   * Initializes the read-write object store.
   *
   * @param {IDBObjectStore} storage The native Indexed DB object store.
   * @param {function(): ReadOnlyTransaction} transactionFactory A function
   *        that creates and returns a new read-only transaction each time it
   *        is invoked.
   */
  constructor(storage, transactionFactory) {
    super(storage, Cursor, transactionFactory)

    /**
     * The native Indexed DB object store used as the storage of records.
     *
     * @type {IDBObjectStore}
     */
    this[FIELDS.objectStore] = storage

    /**
     * Cache of created index instances.
     *
     * @type {Map<string, ReadOnlyIndex>}
     */
    this[FIELDS.indexes] = new Map()

    /**
     * A function that creates and returns a new read-only transaction each
     * time it is invoked.
     *
     * @type {function(): ReadOnlyTransaction}
     */
    this[FIELDS.transactionFactory] = transactionFactory

    Object.freeze(this)
  }

  /**
   * Creates a new record in this object store.
   *
   * The changes will be permanent only after the current read-write
   * transaction successfuly completes.
   *
   * @param {*} record The record to create in this object store.
   * @param {(undefined|number|string|Date|Array)=} key The primary key of the
   *        record. This parameter must be specified only if this object store
   *        uses out-of-line keys and does not use a key generator.
   * @return {PromiseSync<(number|string|Date|Array)>}
   */
  add(record, key = undefined) {
    let request = this[FIELDS.objectStore].add(record, key)
    return PromiseSync.resolve(request)
  }

  /**
   * Updates the provided record in this object store.
   *
   * The changes will be permanent only after the current read-write
   * transaction successfuly completes.
   *
   * @param {*} record The record to save into the object store.
   * @param {(undefined|number|string|Date|Array)=} key The primary key of the
   *        record. This parameter must be specified only if this object store
   *        uses out-of-line keys.
   * @return {PromiseSync<(number|string|Date|Array)>} A promise that resolves to
   *         the record key when the operation is successfuly queued.
   */
  put(record, key = undefined) {
    let request = this[FIELDS.objectStore].put(record, key)
    return PromiseSync.resolve(request)
  }

  /**
   * Deletes all records matching the provided filter.
   * 
   * @param {(number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
   *        filter A filter specifying which records should be deleted.
   *        If a function is provided, the first argument will be set to the
   *        record, the second argument will be set to the primary key of the
   *        record, and the third argument will be set to the key referencing
   *        the record (the primary key if traversing an object store).
   * @return {PromiseSync<undefined>} A promise that resolves when all matching
   *         records have been deleted.
   */
  delete(filter) {
    filter = normalizeFilter(filter, this.keyPath)

    if (filter instanceof IDBKeyRange) {
      let request = this[FIELDS.objectStore].delete(filter)
      return PromiseSync.resolve(request)
    }

    return new PromiseSync((resolve, reject) => {
      let progressPromise = Promise.resolve(null)

      this.forEach(filter, CursorDirection.NEXT, (record, primaryKey) => {
        progressPromise = progressPromise.then(
          () => this.delete(primaryKey),
          reject
        )
      }).then(() => resolve(progressPromise))
    })
  }

  /**
   * Deletes all records in this object store.
   *
   * @return {PromiseSync<undefined>} A promise that resolves when all records have
   *         been deleted.
   */
  clear() {
    let request = this[FIELDS.objectStore].clear()
    return PromiseSync.resolve(request)
  }

  /**
   * Retrieves the read-write index of the specified name.
   *
   * This method returns the same index object if invoked repeatedly with the
   * same name on the same instance.
   *
   * @param {string} indexName The name of the index to retrieve.
   * @return {Index} The requested index.
   */
  getIndex(indexName) {
    if (this[FIELDS.indexes].has(indexName)) {
      return this[FIELDS.indexes].get(indexName)
    }

    let nativeIndex = this[FIELDS.objectStore].index(indexName)
    let index = new Index(
      nativeIndex,
      this[FIELDS.transactionFactory]
    )

    this[FIELDS.indexes].set(indexName, index)

    return index
  }

  /**
   * Opens a read-write cursor that traverses the records of this object store,
   * resolving to the traversed records.
   *
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {(CursorDirection|string)=} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"}. The letter case used in the strings does not
   *        matter. Defaults to {@code CursorDirection.NEXT}.
   * @return {PromiseSync<Cursor>} A promise that resolves to a cursor pointing
   *         to the first matched record.
   */
  openCursor(keyRange = undefined, direction = CursorDirection.NEXT) {
    return super.openCursor(keyRange, direction)
  }
}
