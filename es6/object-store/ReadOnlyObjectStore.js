
import AbstractReadOnlyStorage from "./AbstractReadOnlyStorage"
import CursorDirection from "./CursorDirection"
import ReadOnlyIndex from "./ReadOnlyIndex"
import executeQuery from "./query-engine"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  objectStore: Symbol("objectStore"),
  indexes: Symbol("indexes"),
  transactionFactory: Symbol("transactionFactory"),
  cursorConstructor: Symbol("cursorConstructor")
})

/**
 * Read-only accessor to an object store.
 */
export default class ReadOnlyObjectStore extends AbstractReadOnlyStorage {
  /**
   * Initializes the read-only object store.
   *
   * @param {IDBObjectStore} storage The native Indexed DB object store.
   * @param {function(new: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   * @param {function(): ReadOnlyTransaction} transactionFactory A function
   *        that creates and returns a new read-only transaction each time it
   *        is invoked.
   */
  constructor(storage, cursorConstructor, transactionFactory) {
    let storageFactory = () => {
      let transaction = transactionFactory()
      return transaction.getObjectStore(storage.name)
    }
    super(storage, cursorConstructor, storageFactory)

    /**
     * When {@code true}, the keys of the newly created records in this object
     * store will be automatically generated by the object store.
     *
     * The generated keys are positive integers in ascending order.
     *
     * @type {boolean}
     */
    this.autoIncrement = storage.autoIncrement

    /**
     * The names of indexed defined on this object store.
     *
     * The names are sorted in the ascending order.
     *
     * @type {string[]}
     */
    this.indexNames = Object.freeze(Array.from(storage.indexNames))

    /**
     * The native Indexed DB object store.
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
    
    /**
     * Constructor of the cursor to use when traversing the storage records.
     * 
     * @type {function(new: ReadyOnlyCursor)}
     */
    this[FIELDS.cursorConstructor] = cursorConstructor

    if (this.constructor === ReadOnlyObjectStore) {
      Object.freeze(this)
    }
  }

  /**
   * Retrieves the read-only index of the specified name.
   *
   * This method returns the same index object if invoked repeatedly with the
   * same name on the same instance.
   *
   * @param {string} indexName The name of the index to retrieve.
   * @return {ReadOnlyIndex} The requested index.
   */
  getIndex(indexName) {
    if (this[FIELDS.indexes].has(indexName)) {
      return this[FIELDS.indexes].get(indexName)
    }

    let nativeIndex = this[FIELDS.objectStore].index(indexName)
    let index = new ReadOnlyIndex(
      nativeIndex,
      this[FIELDS.cursorConstructor],
      this[FIELDS.transactionFactory]
    )

    this[FIELDS.indexes].set(indexName, index)

    return index
  }
  
  /**
   * Executes the specified high-level query on this object store. The method
   * will attempt to do this as efficiently as possible, however, note the
   * following situations that may impact the performance heavily:
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
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
   *        The filter, restricting the records returned by this method. If a
   *        function is provided, the first argument will be set to the record
   *        and the second argument will be set to the primary key of the
   *        record.
   * @param {?(CursorDirection|string|string[]|function(*, *): number)} order
   *        How the resulting records should be sorted. This can be one of the
   *        following:
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
   * @param {number} offset The index of the first record to include in the
   *        result. The records are numbered from {@code 0}, the offset must be
   *        a non-negative integer.
   * @param {?number} limit The maximum number of records to return as a
   *        result. The limit must be a positive integer, or {@code null} if no
   *        limit should be imposed.
   * @return {PromiseSync<*[]>} A promise that resolves to the fetched records.
   */
  query(filter = null, order = CursorDirection.NEXT, offset = 0,
      limit = null) {
    let records = []
    
    return executeQuery(this, filter, order, offset, limit, (record) => {
      records.push(record)
    }).then(() => records)
  }
}
