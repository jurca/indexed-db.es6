
import KeyRange from "./KeyRange"
import CursorDirection from "./CursorDirection"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  storageFactory: Symbol("storageFactory"),
  nextKey: Symbol("nextKey"),
  firstPrimaryKey: Symbol("firstPrimaryKey"),
  cursorDirection: Symbol("cursorDirection"),
  unique: Symbol("unique"),
  filter: Symbol("filter"),
  pageSize: Symbol("pageSize"),
  hasNextPage: Symbol("hasNextPage")
})

/**
 * The record list is an array of records, representing a single page of record
 * listing.
 *
 * The record list provides API for easy fetching of the next page of records,
 * while not being dependent on the current transaction.
 */
export default class RecordList extends Array {
  /**
   * Initializes the record list.
   *
   * @param {*[]} items The records of the record list.
   * @param {function(): AbstractReadOnlyStorage} storageFactory A function
   *        that creates a new read-only transaction and returns this storage
   *        accessor each time it is invoked.
   * @param {(number|string|Date|Array)} nextKey The storage key of the first
   *        record to include in the next page.
   * @param {(number|string|Date|Array)} firstPrimaryKey The primary key of the
   *        first record to include in the next page.
   * @param {CursorDirection} cursorDirection The direction in which the
   *        records of the storage are traversed.
   * @param {boolean} unique Set to {@code true} if the key used by the storage
   *        to organize records has a unique value for each record.
   * @param {(undefined|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
   *        filter The filter function restricting the records that will be
   *        listed.
   * @param {number} pageSize The number of records per page specified as a
   *        positive integer.
   * @param {boolean} hasNextPage Set to {@code true} if more records were
   *        available when this record list was initialized.
   */
  constructor(items, storageFactory, nextKey, firstPrimaryKey, cursorDirection,
      unique, filter, pageSize, hasNextPage) {
    super()

    if (items.length > pageSize) {
      throw new Error("The record list cannot be longer than the page size")
    }

    /**
     * A function that creates a new read-only transaction and returns this
     * storage accessor each time it is invoked.
     *
     * @type {function(): AbstractReadOnlyStorage}
     */
    this[FIELDS.storageFactory] = storageFactory

    /**
     * The storage key of the first record to include in the next page.
     *
     * @type {(number|string|Date|Array)}
     */
    this[FIELDS.nextKey] = nextKey

    /**
     * The primary key of the first record to include in the next page.
     *
     * @type {(number|string|Date|Array)}
     */
    this[FIELDS.firstPrimaryKey] = firstPrimaryKey

    /**
     * The direction in which the records of the storage are traversed.
     *
     * @type {CursorDirection}
     */
    this[FIELDS.cursorDirection] = cursorDirection

    /**
     * Set to {@code true} if the key used by the storage to organize records
     * has a unique value for each record.
     *
     * @type {boolean}
     */
    this[FIELDS.unique] = unique

    /**
     * The filter function restricting the records that will be listed.
     *
     * @type {(undefined|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
     */
    this[FIELDS.filter] = filter

    /**
     * The number of records per page specified as a positive integer.
     *
     * @type {number}
     */
    this[FIELDS.pageSize] = pageSize

    /**
     * Set to {@code true} if more records were available when this record list
     * was initialized.
     *
     * @type {boolean}
     */
    this[FIELDS.hasNextPage] = hasNextPage

    this.push.apply(this, items)
  }

  /**
   * Returns {@code true} if a next page of records is available. The method
   * may return {@code true} even if there are no more records available
   * because they were deleted since this record list was initialized.
   *
   * @rerurn {@code true} if a next page of records is available.
   */
  get hasNextPage() {
    return this[FIELDS.hasNextPage]
  }

  /**
   * Fetches the next page of records. The records will be fetched in a new
   * read-only transaction.
   *
   * @return {Promise<RecordList<*>>} A promise that resolves to the records
   *         list containing the next page of records.
   */
  fetchNextPage() {
    if (!this.hasNextPage) {
      throw new Error("There are no more pages of records to fetch")
    }

    let storageFactory = this[FIELDS.storageFactory]
    let cursorDirection = this[FIELDS.cursorDirection]
    let unique = this[FIELDS.unique]
    let keyRange
    if (cursorDirection === CursorDirection.NEXT) {
      keyRange = KeyRange.lowerBound(this[FIELDS.nextKey])
    } else {
      keyRange = KeyRange.upperBound(this[FIELDS.nextKey])
    }
    let pageSize = this[FIELDS.pageSize]

    return fetchNextPage(storageFactory, keyRange, cursorDirection, unique,
        this[FIELDS.firstPrimaryKey], this[FIELDS.filter], pageSize)
  }
}

/**
 * Fetches the next page of records in a new ready-only transaction and
 * resolves into a record list containing the fetched records.
 *
 * @param {function(): AbstractReadOnlyStorage} storageFactory A function that
 *        creates a new read-only transaction and returns this storage accessor
 *        each time it is invoked.
 * @param {IDBKeyRange} keyRange The key range to use when opening the cursor
 *        in order to skip most of the records traversed previously.
 * @param {CursorDirection} cursorDirection The direction in which the records
 *        of the storage are traversed.
 * @param {boolean} unique Set to {@code true} if the key used by the storage
 *        to organize records has a unique value for each record.
 * @param {(number|string|Date|Array)} firstPrimaryKey The primary key of the
 *        first record to include to the result.
 * @param {(undefined|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
 *        filter The filter function restricting the records that will be
 *        listed.
 *        If a function is provided, the first argument will be set to the
 *        record, the second argument will be set to the primary key of the
 *        record, and the third argument will be set to the key referencing the
 *        record (the primary key if traversing an object store).
 * @param {number} pageSize The maximum number of records per page. Must be a
 *        positive integer.
 * @return {Promise<RecordList<*>>} A promise that resolves to the next page of
 *         records.
 */
function fetchNextPage(storageFactory, keyRange, cursorDirection, unique,
    firstPrimaryKey, filter, pageSize) {
  let storage = storageFactory()

  let nextItems = []

  return new Promise((resolve, reject) => {
    storage.openCursor(keyRange, cursorDirection, unique).
        then(iterate).
        catch(reject)

    function iterate(cursor) {
      if (cursor.done) {
        finalize(false, null, null)
        return
      }

      if (!unique) {
        let shouldSkip =
          (
            (cursorDirection === CursorDirection.NEXT) &&
            (indexedDB.cmp(firstPrimaryKey, cursor.primaryKey) > 0)
          ) || (
            (cursorDirection === CursorDirection.PREVIOUS) &&
            (indexedDB.cmp(firstPrimaryKey, cursor.primaryKey) < 0)
          )

        if (shouldSkip) {
          cursor.advance().
              then(iterate).
              catch(reject)
          return
        }
      }

      if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
        if (nextItems.length === pageSize) {
          finalize(true, cursor.key, cursor.primaryKey)
        } else {
          nextItems.push(cursor.record)
        }
      }

      cursor.advance().
          then(iterate).
          catch(reject)
    }

    function finalize(hasNextPage, nextKey, nextPrimaryKey) {
      resolve(new RecordList(nextItems, storageFactory, nextKey,
          nextPrimaryKey, cursorDirection, unique, filter, pageSize,
          hasNextPage))
    }
  })
}
