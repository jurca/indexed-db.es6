
import PromiseSync from "../PromiseSync"
import CursorDirection from "./CursorDirection"

/**
 * Values allowed as cursor directions.
 * 
 * @type {(CursorDirection|string)[]}
 */
const CURSOR_DIRECTIONS = [
  CursorDirection.NEXT,
  CursorDirection.PREVIOUS,
  "NEXT",
  "PREVIOUS",
  "PREV"
]

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
   * Initializes the storage. The overriding implementation should freeze the
   * instance object once it is fully initialized.
   *
   * @param {(IDBObjectStore|IDBIndex)} storage The native Indexed DB object
   *        store or index.
   * @param {function(new: ReadOnlyCursor, IDBRequest, function(), function(IDBRequest): PromiseSync)} cursorConstructor
   *        Constructor of the cursor to use when traversing the storage
   *        records.
   */
  constructor(storage, cursorConstructor) {
    if (this.constructor === AbstractBaseStorage) {
      throw new Error("THe AbstractBaseStorage class is abstract and must " +
          "be overridden")
    }

    let keyPath = storage.keyPath
    if (keyPath && (typeof keyPath !== "string")) {
      keyPath = Object.freeze(Array.from(keyPath))
    }
    
    /**
     * The key path of this object store or index, specified as a sequence of
     * field names joined by dots (if the object store uses in-line keys), or
     * an array of field names if the object store uses a compound key, or
     * {@code null} if this is an object store that uses out-of-line keys.
     *
     * @type {?(string|string[])}
     */
    this.keyPath = keyPath || null

    /**
     * The name of this object store.
     *
     * @type {string}
     */
    this.name = storage.name

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
     * @type {function(new: ReadOnlyCursor, IDBRequest, function(), function(IDBRequest): PromiseSync)}
     */
    this[FIELDS.cursorConstructor] = cursorConstructor
  }

  /**
   * Retrieves a single record identified by the specified key value.
   *
   * If the key is an {@linkcode IDBKeyRange} instance, or the key value
   * matches multiple records, the method retrieves the first record matching
   * the key / key range.
   *
   * There are the following ways of specifying a compound key:
   * - An array of primary key field values. The values must be specified in
   *   the same order as the key paths of this object store.
   * - An {@code Object<string, (number|string|Date|Array)>} object specifying
   *   only the primary key field values.
   *
   * @param {(number|string|Date|Array|Object|IDBKeyRange)} key The key value
   *        identifying the record.
   * @return {PromiseSync<*>} A promise that resolves to the record, or
   *         {@code undefined} if the record does not exist. The also promise
   *         resolves to {@code undefined} if the record exists, but it is the
   *         {@code undefined} value.
   */
  get(key) {
    let isCompoundKeyObject = (key instanceof Object) &&
        !(key instanceof Date) &&
        !(key instanceof IDBKeyRange)
    if (isCompoundKeyObject) {
      if (!(this.keyPath instanceof Array)) {
        throw new Error("This storage does not use a compound key, but one " +
            "was provided")
      }
      key = normalizeCompoundObjectKey(this.keyPath, key)
    }

    let request = this[FIELDS.storage].get(key)
    return PromiseSync.resolve(request)
  }

  /**
   * Opens a read-only cursor that traverses the records of this storage,
   * resolving to the traversed records.
   * 
   * The returned promise resolves once the record callback does not invoke
   * the {@code continue} nor the {@code advance} method synchronously or the
   * cursor reaches the end of available records.
   *
   * @param {?(number|string|Date|Array|IDBKeyRange)} keyRange A key range to
   *        use to filter the records by matching the values of their primary
   *        keys against this key range.
   * @param {(CursorDirection|string)} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {function(ReadOnlyCursor)} recordCallback A callback executed every
   *        time the cursor traverses to a record.
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         records the cursor traversed.
   */
  openCursor(keyRange, direction, recordCallback) {
    return this.createCursorFactory(keyRange, direction)(recordCallback)
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
   * @return {function(function(ReadOnlyCursor)): PromiseSync<number>} A cursor
   *         factory. The factory accepts a callback to execute on every record
   *         the cursor iterates over. The promise returned by the factory
   *         resolves once the record callback does not invoke the
   *         {@code continue} nor the {@code advance} method synchronously or
   *         the cursor reaches the end of available records.
   */
  createCursorFactory(keyRange = undefined, direction = CursorDirection.NEXT) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]
    
    if (typeof direction === "string") {
      if (CURSOR_DIRECTIONS.indexOf(direction.toUpperCase()) === -1) {
        throw new Error("When using a string as cursor direction, use NEXT " +
            `or PREVIOUS, ${direction} provided`);
      }
    } else {
      direction = direction.value
    }

    let cursorDirection = direction.toLowerCase().substring(0, 4)
    
    return (recordCallback) => {
      let request = this[FIELDS.storage].openCursor(keyRange, cursorDirection)
      return iterateCursor(request, cursorConstructor, recordCallback)
    }
  }
}

/**
 * Iterates the cursor to which the provided Indexed DB request resolves. The
 * method will iterate the cursor over the records in this storage within the
 * range specified when the cursor was opened until the provided callback does
 * not request iterating to the next record or the last matching record is
 * reached.
 * 
 * @param {IDBRequest} request Indexed DB request that resolves to a cursor
 *        every time the cursor iterates to a record.
 * @param {function(new: ReadOnlyCursor, IDBRequest, function(), function(IDBRequest): PromiseSync)} cursorConstructor
 *        Constructor of the cursor class to use to wrap the native IDBRequest
 *        producing the native IndexedDB cursor.
 * @param {function(ReadOnlyCursor)} recordCallback The callback to execute,
 *        passing a high-level cursor instance pointing to the current record
 *        in each iteration of the cursor.
 * @return {PromiseSync<number>} A promise that resolves to the number of
 *         records the cursor traversed.
 */
function iterateCursor(request, cursorConstructor, recordCallback) {
  return new PromiseSync((resolve, reject) => {
    let traversedRecords = 0
    let canIterate = true
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (!canIterate) {
        console.warn("Cursor iteration was requested asynchronously, " +
            "ignoring the new cursor position")
        return
      }
      
      if (!request.result) {
        resolve(traversedRecords)
        return
      }
      
      traversedRecords++
      
      let iterationRequested = handleCursorIteration(
        request,
        cursorConstructor,
        recordCallback,
        reject
      )
      
      if (!iterationRequested) {
        canIterate = false
        resolve(traversedRecords)
      }
    }
  })
}

/**
 * Handles a single iteration of a Indexed DB cursor iterating the records in
 * the storage.
 * 
 * @param {IDBRequest} request Indexed DB request resolved to a cursor.
 * @param {function(new: ReadOnlyCursor, IDBRequest, function(), function(IDBRequest): PromiseSync)} cursorConstructor
 *        Constructor of the high-level cursor implementation to use.
 * @param {function(ReadOnlyCursor)} recordCallback The callback to execute,
 *        passing a high-level cursor instance pointing to the current record.
 * @param {function(Error)} reject Callback to call if any sub-operation
 *        triggered by the callback results in an error.
 * @return {boolean} {@code true} if the cursor should iterate to the next
 *         record.
 */
function handleCursorIteration(request, cursorConstructor, recordCallback,
    reject) {
  let iterationRequested = false
  let cursor = new cursorConstructor(request, () => {
    iterationRequested = true
  }, (subRequest) => {
    return PromiseSync.resolve(subRequest).catch((error) => {
      reject(error)
      throw error
    })
  })
  
  try {
    recordCallback(cursor)
  } catch (error) {
    iterationRequested = false
    reject(error)
  }
  
  return iterationRequested
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
