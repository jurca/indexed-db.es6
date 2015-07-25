
import PromiseSync from "../PromiseSync"
import ReadOnlyObjectStore from "./ReadOnlyObjectStore"
import Cursor from "./Cursor"
import CursorDirection from "./CursorDirection"
import Index from "./Index"
import executeQuery from "./query-engine"
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
   * transaction successfully completes.
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
   * transaction successfully completes.
   *
   * @param {*} record The record to save into the object store.
   * @param {(undefined|number|string|Date|Array)=} key The primary key of the
   *        record. This parameter must be specified only if this object store
   *        uses out-of-line keys.
   * @return {PromiseSync<(number|string|Date|Array)>} A promise that resolves
   *         to the record key when the operation is successfuly queued.
   */
  put(record, key = undefined) {
    let request = this[FIELDS.objectStore].put(record, key)
    return PromiseSync.resolve(request)
  }

  /**
   * Deletes all records matching the provided filter.
   * 
   * @param {(number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)} filter
   *        A filter specifying which records should be deleted. If a function
   *        is provided, the first argument will be set to the record, the
   *        second argument will be set to the primary key of the record, and
   *        the third argument will be set to the key referencing the record
   *        (the primary key if traversing an object store).
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
      let progressPromise = PromiseSync.resolve(null)

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
   * @return {PromiseSync<undefined>} A promise that resolves when all records
   *         have been deleted.
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
   * The returned promise resolves once the record callback does not invoke
   * the {@code continue} nor the {@code advance} method synchronously or the
   * cursor reaches the end of available records.
   *
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {(CursorDirection|string)} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {function(Cursor)} recordCallback A callback executed every time
   *        the cursor traverses to a record.
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         records the cursor traversed.
   */
  openCursor(keyRange, direction, recordCallback) {
    return super.openCursor(keyRange, direction, recordCallback)
  }
  
  /**
   * Creates a factory function for opening cursors on this storage with the
   * specified configuration for the duration of the current transaction.
   * 
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange)=} keyRange A key
   *        range to use to filter the records by matching the values of their
   *        primary keys against this key range.
   * @param {(CursorDirection|string)=} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @return {function(function(Cursor)): PromiseSync<number>} A cursor
   *         factory. The factory accepts a callback to execute on every record
   *         the cursor iterates over. The promise returned by the factory
   *         resolves once the record callback does not invoke the
   *         {@code continue} nor the {@code advance} method synchronously or
   *         the cursor reaches the end of available records.
   */
  createCursorFactory(keyRange = undefined, direction = CursorDirection.NEXT) {
    return super.createCursorFactory(keyRange, direction)
  }

  /**
   * Executes the specified high-level update query on this object store. The
   * method will attempt to do this as efficiently as possible, however, note
   * the following situations that may impact the performance heavily:
   *
   * - using a function as filter
   * - using an object-map of fields to values or key ranges as filter that
   *   cannot be transformed to a single key range even partially. This happens
   *   when the storage (object store or index) chosen by this method has a key
   *   path that contains a field path not present in the filter object, or a
   *   field path that resolves to a key range within the filter object.
   * - using a comparator function to specify the expected order of records.
   * - using field paths that do not have the same direction to specify the
   *   expected order of records.
   * - using field paths that do not match the key path of this object store
   *   nor the key paths of any of its indexes.
   *
   * The method prefers to optimize the record sorting as it has (usually)
   * greater performance impact that optimizing filter if both cannot be
   * optimized simultaneously.
   *
   * Note that if the sorting cannot be optimized, the method can execute the
   * callback on the provided records only after it traverses all records
   * matching the filter.
   *
   * Important to note: never attempt to modify the primary key of the record,
   * especially in case of records with in-line keys. Such modification may
   * result in preserving the old record along with the new one with the
   * modified primary key.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
   *        The filter, restricting the records affected by this method. If a
   *        function is provided, the first argument will be set to the record
   *        and the second argument will be set to the primary key of the
   *        record.
   * @param {?(CursorDirection|string|string[]|function(*, *): number)} order
   *        How the records should be sorted. This can be one of the following:
   *        - a {@code CursorDirection} constant, either {@code NEXT} or
   *          {@code PREVIOUS} for ascending or descending order respectively
   *        - {@code null} as alias for {@code CursorDirection.NEXT}
   *        - one of the {@code "NEXT"} (alias for
   *          {@code CursorDirection.NEXT}), {@code "PREVIOUS"} or
   *          {@code "PREV"} (aliases for {@code CursorDirection.PREVIOUS})
   *        - a string containing a field path, meaning the records should be
   *          sorted by the values of the denoted field (note that the field
   *          must exist in all records and its value must be a valid IndexedDB
   *          key value).
   *          The order is ascending by default, use the {@code "!" prefix} for
   *          descending order.
   *          To sort by a field named {@code NEXT}, {@code PREVIOUS} or
   *          {@code PREV} wrap the field path into an array containing the
   *          field path.
   *        - an array of field paths, as described above. The records will be
   *          sorted by the values of the specified fields lexicographically.
   *        - a comparator function compatible with the
   *          {@linkcode Array.prototype.sort} method.
   * @param {number} offset The index of the first record to modify. The
   *        records are numbered from {@code 0}, the offset must be a
   *        non-negative integer.
   * @param {?number} limit The maximum number of records to modify. The limit
   *        must be a positive integer, or {@code null} if no limit should be
   *        imposed.
   * @return {function(function(*, (number|string|Date|Array)): *): PromiseSync<number>}
   *         A factory function that accepts a callback that will be executed
   *         on each record and its primary key. The value returned by the
   *         callback will be saved in place of the original record. The
   *         factory function returns a promise that will resolve once all
   *         records have been processed. The promise resolves to the number of
   *         updated records.
   */
  updateQuery(filter = null, order = CursorDirection.NEXT, offset = 0,
      limit = null) {
    return (recordCallback) => {
      let recordCount = 0

      return executeQuery(this, filter, order, offset, limit, (record, id) => {
        let newRecord = recordCallback(record, id)
        recordCount++

        if (this.keyPath) {
          this.put(newRecord)
        } else {
          this.put(newRecord, id)
        }
      }).then(() => recordCount)
    }
  }

  /**
   * Executes the specified high-level delete query on this object store. The
   * method will attempt to do this as efficiently as possible, however, note
   * the following situations that may impact the performance heavily:
   *
   * - using a function as filter
   * - using an object-map of fields to values or key ranges as filter that
   *   cannot be transformed to a single key range even partially. This happens
   *   when the storage (object store or index) chosen by this method has a key
   *   path that contains a field path not present in the filter object, or a
   *   field path that resolves to a key range within the filter object.
   * - using a comparator function to specify the expected order of records.
   * - using field paths that do not have the same direction to specify the
   *   expected order of records.
   * - using field paths that do not match the key path of this object store
   *   nor the key paths of any of its indexes.
   *
   * The method prefers to optimize the record sorting as it has (usually)
   * greater performance impact that optimizing filter if both cannot be
   * optimized simultaneously.
   *
   * Note that if the sorting cannot be optimized, the method can execute the
   * callback on the provided records only after it traverses all records
   * matching the filter.
   *
   * Important to note: never attempt to modify the primary key of the record,
   * especially in case of records with in-line keys. Such modification may
   * result in preserving the old record along with the new one with the
   * modified primary key.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
   *        The filter, restricting the records deleted by this method. If a
   *        function is provided, the first argument will be set to the record
   *        and the second argument will be set to the primary key of the
   *        record.
   * @param {?(CursorDirection|string|string[]|function(*, *): number)} order
   *        How the records should be sorted. This can be one of the following:
   *        - a {@code CursorDirection} constant, either {@code NEXT} or
   *          {@code PREVIOUS} for ascending or descending order respectively
   *        - {@code null} as alias for {@code CursorDirection.NEXT}
   *        - one of the {@code "NEXT"} (alias for
   *          {@code CursorDirection.NEXT}), {@code "PREVIOUS"} or
   *          {@code "PREV"} (aliases for {@code CursorDirection.PREVIOUS})
   *        - a string containing a field path, meaning the records should be
   *          sorted by the values of the denoted field (note that the field
   *          must exist in all records and its value must be a valid IndexedDB
   *          key value).
   *          The order is ascending by default, use the {@code "!" prefix} for
   *          descending order.
   *          To sort by a field named {@code NEXT}, {@code PREVIOUS} or
   *          {@code PREV} wrap the field path into an array containing the
   *          field path.
   *        - an array of field paths, as described above. The records will be
   *          sorted by the values of the specified fields lexicographically.
   *        - a comparator function compatible with the
   *          {@linkcode Array.prototype.sort} method.
   * @param {number} offset The index of the first record to delete. The
   *        records are numbered from {@code 0}, the offset must be a
   *        non-negative integer.
   * @param {?number} limit The maximum number of records to delete. The limit
   *        must be a positive integer, or {@code null} if no limit should be
   *        imposed.
   * @return {PromiseSync<number>} A promise resolved when the records have
   *         been deleted. The promise resolves to the number of deleted
   *         records.
   */
  deleteQuery(filter = null, order = CursorDirection.NEXT, offset = 0,
      limit = null) {
    let recordCount = 0

    return executeQuery(this, filter, order, offset, limit, (record, id) => {
      this.delete(id)
      recordCount++
    }).then(() => recordCount)
  }
}
