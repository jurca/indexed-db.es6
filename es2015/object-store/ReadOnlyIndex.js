
import PromiseSync from "../PromiseSync"
import AbstractReadOnlyStorage from "./AbstractReadOnlyStorage"
import CursorDirection from "./CursorDirection"
import ReadOnlyCursor from "./ReadOnlyCursor"

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
 * Read-only accessor for an index.
 */
export default class ReadOnlyIndex extends AbstractReadOnlyStorage {
  /**
   * Initializes the read-only index.
   *
   * @param {IDBIndex} storage The native Indexed DB index.
   * @param {function(new: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   * @param {function(): ReadOnlyTransaction} transactionFactory A function
   *        that creates and returns a new read-only transaction each time it
   *        is invoked.
   */
  constructor(storage, cursorConstructor, transactionFactory) {
    let storageFactory = () => {
      let transaction = transactionFactory()
      let objectStore = transaction.getObjectStore(storage.objectStore.name)
      return objectStore.index(storage.name)
    }
    super(storage, cursorConstructor, storageFactory)

    /**
     * When {@code true}, and a record's index key path evaluates to an array,
     * the index stores an index key value for each element of the evaluated
     * array.
     *
     * @type {boolean}
     */
    this.multiEntry = storage.multiEntry

    /**
     * When {@code true}, the index enforces that no records may share the same
     * index key value.
     *
     * @type {boolean}
     */
    this.unique = storage.unique

    /**
     * The native Indexed DB index.
     *
     * @type {IDBIndex}
     */
    this[FIELDS.storage] = storage

    /**
     * The constructor function of the cursor to use to create cursor
     * instances.
     *
     * @type {function(new: ReadyOnlyCursor)}
     */
    this[FIELDS.cursorConstructor] = cursorConstructor

    if (this.constructor === ReadOnlyIndex) {
      Object.freeze(this)
    }
  }

  /**
   * Retrieves the primary key of the first record matching the specified key
   * value or key range.
   *
   * @param {(number|string|Date|Array|IDBKeyRange)} key The index key or key
   *        range for which a record primary key should be retrieved.
   * @return {PromiseSync<(undefined|number|string|Date|Array)>} A promise that
   *         resolves to the primary key of the first record matching the
   *         specified index key or key range. The promise resolves to
   *         {@code undefined} if no record is found.
   */
  getPrimaryKey(key) {
    let request = this[FIELDS.storage].getKey(key)
    return PromiseSync.resolve(request)
  }

  /**
   * Traverses the keys in this index in the ascending order and resolves into
   * the primary keys of all traversed records.
   *
   * @return {PromiseSync<(number|string|Date|Array)[]>} A promise that
   *         resolves to a list of all record primary keys obtained by getting
   *         the primary of records traversed by traversing the key of this
   *         index in the ascending order.
   */
  getAllPrimaryKeys() {
    let primaryKeys = [];

    return this.openKeyCursor(null, CursorDirection.NEXT, false, (cursor) => {
      primaryKeys.push(cursor.primaryKey)
      cursor.continue()
    }).then(() => primaryKeys)
  }

  /**
   * Opens a read-only cursor that traverses the records of this index,
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
   * @param {boolean} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @param {function(ReadOnlyCursor)} recordCallback A callback executed every
   *        time the cursor traverses to a record.
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         records the cursor traversed.
   */
  openCursor(keyRange, direction, unique, recordCallback) {
    let factory = this.createCursorFactory(keyRange, direction, unique)
    return factory(recordCallback)
  }

  /**
   * Opens a read-only cursor that traverses the records of this index,
   * resolving only the primary keys of the records.
   *
   * The returned promise resolves once the record callback does not invoke
   * the {@code continue} nor the {@code advance} method synchronously or the
   * cursor reaches the end of available records.
   *
   * The {@code record} field of the cursor will always be {@code null}.
   *
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {(CursorDirection|string)} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {boolean} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @param {function(ReadOnlyCursor)} recordCallback A callback executed every
   *        time the cursor traverses to a record.
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         iterations the cursor has made (this may be larger than the number
   *         of records traversed if the index has its {@code multiEntry} flag
   *         set and some records repeatedly appear).
   */
  openKeyCursor(keyRange, direction, unique, recordCallback) {
    let factory = this.createKeyCursorFactory(keyRange, direction, unique)
    return factory(recordCallback)
  }
  
  /**
   * Creates a factory function for opening cursors on this storage with the
   * specified configuration for the duration of the current transaction.
   * 
   * @override
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange)=} keyRange A key
   *        range to use to filter the records by matching the values of their
   *        primary keys against this key range.
   * @param {(CursorDirection|string)=} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @return {function(function(ReadOnlyCursor)): PromiseSync<number>} A cursor
   *         factory. The factory accepts a callback to execute on every record
   *         the cursor iterates over. The promise returned by the factory
   *         resolves once the record callback does not invoke the
   *         {@code continue} nor the {@code advance} method synchronously or
   *         the cursor reaches the end of available records.
   */
  createCursorFactory(keyRange = undefined, direction = CursorDirection.NEXT,
      unique = false) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]
    let cursorDirection = toNativeCursorDirection(direction, unique)
    
    return (recordCallback) => {
      let request = this[FIELDS.storage].openCursor(keyRange, cursorDirection)
      return iterateCursor(request, cursorConstructor, recordCallback)
    }
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
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @return {function(function(ReadOnlyCursor)): PromiseSync<number>} A cursor
   *         factory. The factory accepts a callback to execute on every record
   *         the cursor iterates over. The promise returned by the factory
   *         resolves once the record callback does not invoke the
   *         {@code continue} nor the {@code advance} method synchronously or
   *         the cursor reaches the end of available records.
   */
  createKeyCursorFactory(keyRange = undefined,
      direction = CursorDirection.NEXT, unique = false) {
    if (keyRange === null) {
      keyRange = undefined
    }
    
    let cursorDirection = toNativeCursorDirection(direction, unique)
    
    return (recordCallback) => {
      let request;
      request = this[FIELDS.storage].openKeyCursor(keyRange, cursorDirection)
      return iterateCursor(request, ReadOnlyCursor, recordCallback)
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
 * Returns the cursor direction to use with the native Indexed DB API.
 * 
 * @param {(CursorDirection|string)=} direction The direction in which the
 *        cursor will traverse the records. Use either the
 *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
 *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
 *        used in the strings does not matter.
 * @param {boolean=} unique When {@code true}, it cursor will skip over the
 *        records stored with the same index key value.
 * @return {string} The cursor direction compatible with the native Indexed DB
 *         API.
 */
function toNativeCursorDirection(direction, unique) {
  if (typeof direction === "string") {
    if (CURSOR_DIRECTIONS.indexOf(direction.toUpperCase()) === -1) {
      throw new Error("When using a string as cursor direction, use NEXT " +
          `or PREVIOUS, ${direction} provided`);
    }
  } else {
    direction = direction.value
  }

  let cursorDirection = direction.toLowerCase().substring(0, 4)
  if (unique) {
    cursorDirection += "unique"
  }
  
  return cursorDirection
}
