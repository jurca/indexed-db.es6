
import PromiseSync from "../PromiseSync"
import AbstractBaseStorage from "./AbstractBaseStorage"
import CursorDirection from "./CursorDirection"
import KeyRange from "./KeyRange"
import RecordList from "./RecordList"
import {
  compileFieldRangeFilter,
  normalizeFilter,
  keyRangeToFieldRangeObject
} from "./utils"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  storage: Symbol("storage"),
  unique: Symbol("unique"),
  storageFactory: Symbol("storageFactory")
})

/**
 * Abstract storage accessor providing high-level read-only API.
 *
 * @abstract
 */
export default class AbstractReadOnlyStorage extends AbstractBaseStorage {
  /**
   * Initializes the read-only storage. The overriding implementation should
   * freeze the instance object once it is fully initialized.
   *
   * @param {(IDBObjectStore|IDBIndex)} storage The native Indexed DB object
   *        store or index.
   * @param {function(new: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   * @param {function(): AbstractReadOnlyStorage} A function that creates a new
   *        read-only transaction and returns a new storage accessor for this
   *        storage each time it is invoked.
   */
  constructor(storage, cursorConstructor, storageFactory) {
    super(storage, cursorConstructor)

    if (this.constructor === AbstractReadOnlyStorage) {
      throw new Error("The AbstractReadOnlyStorage class is abstract and " +
          "must be overridden")
    }

    /**
     * The native Indexed DB object store or index.
     *
     * @type {(IDBObjectStore|IDBIndex)}
     */
    this[FIELDS.storage] = storage

    /**
     * When {@code true}, the keys by which the records are organized in the
     * store are always unique for each record.
     *
     * @type {boolean}
     */
    this[FIELDS.unique] = storage instanceof IDBObjectStore || storage.unique

    /**
     * A function that creates a new read-only transaction and returns a new
     * storage accessor for this storage each time it is invoked.
     *
     * @type {function(): AbstractReadOnlyStorage}
     */
    this[FIELDS.storageFactory] = storageFactory
  }
  
  /**
   * Tests whether a record matching the specified filter exists in this
   * storage.
   * 
   * @param {(number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
   *        filter The filter restricting on which records the callback will be
   *        executed. The first argument will be set to the record, the second
   *        argument will be set to the primary key of the record, and the
   *        third argument will be set to the key referencing the record (the
   *        primary key if traversing an object store).
   * @return {PromiseSync<boolean>} A promise that resolves to {@code true} if
   *         there is a record matching the provided filter.
   */
  exists(filter) {
    return this.count(filter).then(count => count > 0)
  }

  /**
   * Calculates the number of records matching the specified filter.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)=}
   *        filter The filter restricting on which records the callback will be
   *        executed. The first argument will be set to the record, the second
   *        argument will be set to the primary key of the record, and the
   *        third argument will be set to the key referencing the record (the
   *        primary key if traversing an object store).
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         records satisfying the filter.
   */
  count(filter = undefined) {
    filter = normalizeFilter(filter, this.keyPath)

    if (filter instanceof Function) {
      return this.forEach(filter, CursorDirection.NEXT, () => {})
    }

    let request = this[FIELDS.storage].count(filter)
    return PromiseSync.resolve(request)
  }

  /**
   * Executes the provided callback on the records in this storage that match
   * the specified filter.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
   *        filter The filter restricting on which records the callback will be
   *        executed. If a function is provided, the first argument will be set
   *        to the record, the second argument will be set to the primary key
   *        of the record, and the third argument will be set to the key
   *        referencing the record (the primary key if traversing an object
   *        store).
   * @param {(CursorDirection|string)} direction The direction in which the
   *        records should be traversed. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter. Defaults to
   *        {@code CursorDirection.NEXT}.
   * @param {function(*, (number|string|Date|Array), (number|string|Date|Array))}
   *        callback The callback to execute on the records matching the
   *        filter. The first argument will be set to the record, the second
   *        argument will be set to the primary key of the record, and the
   *        third argument will be set to the key referencing the record (the
   *        primary key if traversing an object store).
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         records satisfying the filter.
   */
  forEach(filter, direction, callback) {
    filter = normalizeFilter(filter, this.keyPath)

    let keyRange
    if (filter instanceof Function) {
      keyRange = undefined
    } else {
      keyRange = filter
      filter = null
    }
    
    let recordCount = 0

    return this.createCursorFactory(keyRange, direction)((cursor) => {
      if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
        callback(cursor.record, cursor.primaryKey, cursor.key)
        recordCount++
      }
      
      cursor.continue()
    }).then(() => recordCount)
  }

  /**
   * Retrieves all records from this object store that match the specified
   * filter. The records will be listed in the specified order.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)=}
   *        filter The filter, restricting the records returned by this method.
   *        If a function is provided, the first argument will be set to the
   *        record, the second argument will be set to the primary key of the
   *        record, and the third argument will be set to the key referencing
   *        the record (the primary key if traversing an object store).
   * @param {CursorDirection} direction The direction in which the records are
   *        to be listed. Use either the {@code CursorDirection.*} constants,
   *        or strings {@code "NEXT"} and {@code "PREVIOUS"} (or {@code "PREV"}
   *        for short). The letter case used in the strings does not matter.
   *        Defaults to {@code CursorDirection.NEXT}.
   * @return {PromiseSync<Array<*>>} A promise that resolves to an array of all
   *         records matching the filter, listed in the specified order.
   */
  getAll(filter = undefined, direction = CursorDirection.NEXT) {
    return new PromiseSync((resolve, reject) => {
      let records = []

      this.forEach(filter, direction, (record) => {
        records.push(record)
      }).then(() => resolve(records)).
          catch(reject)
    })
  }

  /**
   * Lists the records in this storage in pages of specified size.
   *
   * The records will be returned in a {@codelink RecordStore}, which is an
   * augmented array that can be used to fetch the next page of this listing of
   * records.
   *
   * The {@codelink RecordStore} is not dependent on the current transaction,
   * and therefore the next pages can be fetched even after an arbitrary delay
   * after the current transaction has ended.
   *
   * Fetching the next pages of records will not be affected by read-write
   * operations. Note that new records with primary key of previous value
   * (depending on the used cursor direction) to the last internaly traversed
   * record will not be included in the next pages, as the record list always
   * fetches the next page by fetching the records since the primary key of the
   * last internaly traversed record.
   *
   * Deleting all records after the last fetched record and fetching the next
   * page will result in fetching an empty page of records, that will be marked
   * as the last page.
   *
   * Finally, this method has a slight overhead, because the record list needs
   * to look ahead for one record matching the filter after the last returned
   * record to determine whether additional pages of records are available.
   *
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)=}
   *        filter The filter, restricting the records returned by this method.
   *        If a function is provided, the first argument will be set to the
   *        record, the second argument will be set to the primary key of the
   *        record, and the third argument will be set to the key referencing
   *        the record (the primary key if traversing an object store).
   * @param {(CursorDirection|string)} direction The direction in which the
   *        records are to be listed. Use either the {@code CursorDirection.*}
   *        constants, or strings {@code "NEXT"} and {@code "PREVIOUS"} (or
   *        {@code "PREV"} for short). The letter case used in the strings does
   *        not matter.
   *        Defaults to {@code CursorDirection.NEXT}.
   * @param {number} pageSize The number of records per page.
   * @return {Promise<RecordList<*>>} A promise that resolves to a record list
   *         of the fetched records matching the filter.
   */
  list(filter = undefined, direction = CursorDirection.NEXT, pageSize = 50) {
    if (!/^[1-9]\d*$/.test(`${pageSize}`)) {
      throw new Error("The page size must be a positive integer, " +
          `${pageSize} provided`)
    }

    // convert the filter to a filter function - we need to always set our key
    // range ourselves to have a high-performance paging
    filter = normalizeFilter(filter, this.keyPath)
    let keyRange = undefined
    if (filter instanceof IDBKeyRange) {
      keyRange = filter
      if (this.keyPath) {
        filter = keyRangeToFieldRangeObject(filter, this.keyPath)
        filter = compileFieldRangeFilter(filter)
      } else {
        let primaryKeyFilter = compileFieldRangeFilter({
          primaryKey: filter
        })
        filter = (record, primaryKey) => {
          return primaryKeyFilter({
            primaryKey: primaryKey
          })
        }
      }
    }

    // fetch the first page of records and create a record list
    let unique = this[FIELDS.unique]
    let storageFactory = this[FIELDS.storageFactory]
    return list(this, keyRange, filter, direction, unique, pageSize,
        storageFactory)
  }
}

/**
 * Creates a promise that resolves to a record list containing the first page
 * of records matching the provided filter.
 *
 * @param {AbstractReadOnlyStorage} storage The current storage accessor - will
 *        be used to fetch the first page of records.
 * @param {(undefined|IDBKeyRange)} keyRange The key range to use for the first
 *        page or records.
 * @param {(undefined|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
 *        filter The filter function restricting the records that will be
 *        listed.
 *        If a function is provided, the first argument will be set to the
 *        record, the second argument will be set to the primary key of the
 *        record, and the third argument will be set to the key referencing the
 *        record (the primary key if traversing an object store).
 * @param {CursorDirection} direction The direction in which the records in the
 *        storage should be listed.
 * @param {boolean} unique When {@code true}, the keys by which the records are
 *        organized in the store are always unique for each record.
 * @param {number} pageSize The maximum number of records per page. Must be a
 *        positive integer.
 * @param {function(): AbstractReadOnlyStorage} storageFactory A function that
 *        creates a new read-only transaction and returns this storage accessor
 *        each time it is invoked.
 * @return {Promise<RecordList<*>>} A promise that resolves to a record list of
 *         the fetched records matching the filter.
 */
function list(storage, keyRange, filter, direction, unique, pageSize,
    storageFactory) {
  return new Promise((resolve, reject) => {
    let items = []

    storage.createCursorFactory(keyRange, direction)((cursor) => {
      if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
        if (items.length === pageSize) {
          finalize(true, cursor.key, cursor.primaryKey)
          return
        } else {
          items.push(cursor.record)
        }
      }
      
      cursor.continue()
    }).then(() => finalize(false, null, null)).catch(error => reject(error))

    function finalize(hasNextPage, nextKey, nextPrimaryKey) {
      resolve(new RecordList(items, storageFactory, nextKey, nextPrimaryKey,
          direction, unique, filter, pageSize, hasNextPage))
    }
  })
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
