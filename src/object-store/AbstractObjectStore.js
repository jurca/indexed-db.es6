
import CursorDirection from "./CursorDirection"
import ReadOnlyIndex from "./ReadOnlyIndex"
import ReadOnlyCursor from "./ReadOnlyCursor"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  objectStore: Symbol("objectStore"),
  indexes: Symbol("indexes")
})

/**
 * Base class providing the basic functionality of an object store.
 *
 * @abstract
 */
export default class AbstractObjectStore {
  /**
   * Initializes the read-only object store. The overriding implementation
   * should freeze the instance object once it is fully initialized.
   *
   * @param {IDBObjectStore} objectStore The native IndexedDB object store.
   */
  constructor(objectStore) {
    if (this.constructor === AbstractObjectStore) {
      throw new Error("THe AbstractObjectStore class is abstract and must " +
          "be overridden")
    }

    /**
     * When {@code true}, this object store has the keys for new records
     * generated automatically as a sequence of increasing positive integers.
     *
     * @type {boolean}
     */
    this.autoIncrement = objectStore.autoIncrement

    /**
     * The names of the indexed defined an this object store. The names are
     * sorted in ascending order.
     *
     * @type {string[]}
     */
    this.indexNames = Object.freeze([].slice.call(objectStore.indexNames))

    /**
     * The keypath of this object store, specified as a sequence of field names
     * joined by dots (if the object store uses in-line keys), or {@code null}
     * if this object store uses out-of-line keys.
     *
     * @type {?string}
     */
    this.keyPath = objectStore.keyPath || null

    /**
     * The name of this object store.
     *
     * @type {string}
     */
    this.name = objectStore.name

    /**
     * The native IndexedDB object store in read-only mode.
     *
     * @type {IDBObjectStore}
     */
    this[FIELDS.objectStore] = objectStore

    /**
     * The cache of instances of the indexes of this object store. The keys are
     * index names.
     *
     * @type {Map<string, ReadOnlyIndex>}
     */
    this[FIELDS.indexes] = new Map()
  }

  /**
   * Retrieves a single record identified by the specified primary key value.
   *
   * @param {(boolean|number|string)} primaryKey The primary key value
   *        identifying the record.
   * @return {Promise<?(boolean|number|string|Object)>} A promise that resolves
   *         to the record, or {@code null} if the record does not exist.
   */
  get(primaryKey) {
    let request = this[FIELDS.objectStore].get(primaryKey)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Returns the read-only index of this object store identified by the
   * specified name.
   *
   * @param {string} indexName The name of the index to retrieve.
   * @return {ReadOnlyIndex} The retrieved index.
   */
  getIndex(indexName) {
    if (this[FIELDS.indexes].has(indexName)) {
      return this[FIELDS.indexes].get(indexName)
    }

    let idbIndex = this[FIELDS.objectStore].index(indexName)
    let index = new ReadOnlyIndex(idbIndex)
    this[FIELDS.indexes].set(indexName, index)

    return index
  }

  /**
   * Opens a read-only cursor that traverses the records of this object store,
   * resolving to the traversed records.
   *
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the object store records.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openCursor(keyRange = undefined, direction = CursorDirection.NEXT) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    let objectStore = this[FIELDS.objectStore]
    let request = objectStore.openCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new ReadOnlyCursor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Opens a read-only cursor that traverses the records of this object store,
   * resolving only the primary keys of the records.
   *
   * The {@code record} field of the cursor will always be {@code null}.
   *
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the object store records.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openKeyCursor(keyRange = undefined, direction = CursorDirection.NEXT) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    let objectStore = this[FIELDS.objectStore]
    let request = objectStore.openKeyCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new ReadOnlyCursor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }
}
