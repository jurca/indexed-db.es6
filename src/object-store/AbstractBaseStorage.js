
import CursorDirection from "./CursorDirection"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  storage: Symbol("storage"),
  cursorConstructor: Symbol("cursorConstructor")
})

/**
 * Common base class providing the basic read-only functionality of object
 * stores and indexes.
 *
 * @abstract
 */
export default class AbstractBaseStorage {
  /**
   * Initializes the storage. The overriding implementation
   * should freeze the instance object once it is fully initialized.
   *
   * @param {(IDBObjectStore|IDBIndex)} storage The native Indexed DB object
   *        storage or index.
   * @param {function(this: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   */
  constructor(storage, cursorConstructor) {
    if (this.constructor === AbstractBaseStorage) {
      throw new Error("THe AbstractBaseStorage class is abstract and must " +
          "be overridden")
    }

    /**
     * The keypath of this object store or index, specified as a sequence of
     * field names joined by dots (if the object store uses in-line keys), or
     * an array of field names if the object store uses a compound key, or
     * {@code null} if this is an object store that uses out-of-line keys.
     *
     * @type {?(string|string[])}
     */
    this.keyPath = objectStore.keyPath || null

    /**
     * The name of this object store.
     *
     * @type {string}
     */
    this.name = objectStore.name

    /**
     * The native IndexedDB storage access object - an object store or an
     * index.
     *
     * @type {(IDBObjectStore|IDBIndex)}
     */
    this[FIELDS.storage] = storage

    /**
     * The constructor function of the cursor to use to create cursor
     * instances.
     *
     * @type {function(this: ReadyOnlyCursor)}
     */
    this[FIELDS.cursorConstructor] = cursorConstructor
  }

  /**
   * Retrieves a single record identified by the specified primary key value.
   *
   * if the primary key is an {@codelink IDBKeyRange} instance, the method
   * retrieves the first record matching the key range.
   *
   * There are the following ways of specifying a compound key:
   * - An array of primary key field values. The values must be specified in
   *   the same order as the key paths of this object store.
   * - An {@code Object<string, (number|string|Date|Array)>} object specifying
   *   only the primary key field values.
   *
   * @param {(number|string|Date|Array|Object|IDBKeyRange)} primaryKey The
   *        primary key value identifying the record.
   * @return {Promise<*>} A promise that resolves to the record, or
   *         {@code undefined} if the record does not exist. The also promise
   *         resolves to {@code undefined} if the record exists, but it is the
   *         {@code undefined} value.
   */
  get(primaryKey) {
    let isCompoundKeyObject = (primaryKey instanceof Object) &&
        !(primaryKey instanceof IDBKeyRange)
    if (isCompoundKeyObject) {
      if (!(this.keyPath instanceof Array)) {
        throw new Error("This storage does not use a compound key, but one " +
            "was provided")
      }
      primaryKey = normalizeCompoundObjectKey(this.keyPath, primaryKey)
    }

    let request = this[FIELDS.storage].get(primaryKey)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Opens a read-only cursor that traverses the records of this storage,
   * resolving to the traversed records.
   *
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the records.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openCursor(keyRange = undefined, direction = CursorDirection.NEXT) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    let request = this[FIELDS.storage].openCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new cursorConstructor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Opens a read-only cursor that traverses the records of this storage,
   * resolving only the primary keys of the records.
   *
   * The {@code record} field of the cursor will always be {@code null}.
   *
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the records.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openKeyCursor(keyRange = undefined, direction = CursorDirection.NEXT) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    let request = this[FIELDS.storage].openKeyCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new cursorConstructor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }
}

/**
 * Normalizes the provided compound key represented as an object into a
 * compound key representation compatible with the Indexed DB.
 *
 * @param {string[]} keyPaths The key paths of this storage.
 * @param {Object} key The compound key to normalize for use with the Indexed
 *        DB.
 * @return {Array<(number|string|Date|Array)>} Normalized compound key.
 */
function normalizeCompoundObjectKey(keyPaths, key) {
  let normalizedKey = []

  keyPaths.forEach((keyPath) => {
    let keyValue = key

    keyPath.split(".").forEach((fieldName) => {
      if (!keyValue.hasOwnProperty(fieldName)) {
        throw new Error(`The ${keyPath} key path is not defined in the ` +
            "provided compound key")
      }

      keyValue = keyValue[fieldName]
    })

    normalizedKey.push(keyValue)
  })

  return normalizedKey
}
