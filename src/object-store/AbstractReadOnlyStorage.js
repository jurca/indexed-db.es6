
import AbstractBaseStorage from "./AbstractBaseStorage"
import CursorDirection from "./CursorDirection"
import KeyRange from "./KeyRange"
import RecordList from "./RecordList"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  storage: Symbol("storage"),
  unique: Symbol("unique"),
  storageFactoy: Symbol("storageFactoy")
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
   * @param {function(this: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   */
  constructor(storage, cursorConstructor) {
    super(storage, cursorConstructor, storageFactoy)

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
     * A function that creates a new read-only transaction and returns this
     * storage accessor each time it is invoked.
     *
     * @type {function(): AbstractReadOnlyStorage}
     */
    this[FIELDS.storageFactoy] = storageFactoy
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
   * @return {Promise<number>} A promise that resolves to the number of records
   *         satisfying the filter.
   */
  count(filter = undefined) {
    filter = normalizeFilter(filter, this.keyPath)

    if (filter instanceof Function) {
      return this.forEach(filter, CursorDirection.NEXT, () => {})
    }

    return new Promise((resolve, reject) => {
      let request = this[FIELDS.storage].count(filter)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(result.error)
    })
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
   * @param {CursorDirection} direction The direction in which the records
   *        should be traversed.
   * @param {function(*, (number|string|Date|Array), (number|string|Date|Array))}
   *        callback The callback to execute on the records matching the
   *        filter. The first argument will be set to the record, the second
   *        argument will be set to the primary key of the record, and the
   *        third argument will be set to the key referencing the record (the
   *        primary key if traversing an object store).
   * @return {Promise<number>} A promise that resolves to the number of records
   *         satisfying the filter.
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

    let count = 0
    return new Promise((resolve, reject) => {
      this.openCursor(keyRange, direction).
        then(iterate).
        catch(reject)

      function iterate(cursor) {
        if (!cursor) {
          resolve(count)
          return
        }

        if (filter && filter(cursor.record, cursor.primaryKey, cursor.key)) {
          callback(cursor.record, cursor.primaryKey, cursor.key)
          count++
        }

        cursor.advance().
            then(iterate).
            catch(reject)
      }
    })
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
   *        to be listed.
   * @return {Promise<Array<*>>} A promise that resolves to an array of all
   *         records matching the filter, listed in the specified order.
   */
  getAll(filter = undefined, direction = CursorDirection.NEXT) {
    return new Promise((resolve, reject) => {
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
   * @param {CursorDirection} direction The direction in which the records are
   *        to be listed.
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
    fitler = normalizeFilter(filter, this.keyPath)
    let keyRange = undefined
    if (filter instanceof IDBKeyRange) {
      keyRange = filter
      if (this.keyPath) {
        filter = keyRangeToFieldRangeObject(filter)
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
 */
function list(storage, keyRange, filter, direction, unique, pageSize, storageFactory) {
  return new Promise((resolve, reject) => {
    let items = []

    storage.openCursor(keyRange, direction).
        then(iterate).
        catch(reject)

    function iterate(cursor) {
      if (!cursor) {
        finalize(false, null, null)
        return
      }

      if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
        if (items.length === pageSize) {
          finalize(true, cursor.key, cursor.primaryKey)
        } else {
          items.push(cursor.record)
        }
      }

      cursor.advance().
          then(iterate).
          catch(reject)
    }

    function finalize(hasNextPage, nextKey, nextPrimaryKey) {
      resolve(new RecordList(items, storageFactory, nextKey, nextPrimaryKey,
          direction, unique, filter, pageSize, hasNextPage))
    }
  })
}

/**
 * Converts the provided key range object into a field range map object.
 *
 * @param {IDBKeyRange} keyRange The key range object to convert.
 * @param {(string|string)} keyPath The key path of this storage.
 * @return {Object<string, IDBKeyRange>} A field range map object.
 */
function keyRangeToFieldRangeObject(keyRange, keyPath) {
  let fieldRangeObject = {}

  if (!(keyPath instanceof Array)) {
    setField(fieldRangeObject, keyPath, keyRange)
    return fieldRangeObject
  }

  let lowerBound = keyRange.lower
  let upperBound = keyRange.upper
  let lowerBoundOpen = keyRange.lowerOpen
  let upperBoundOpen = keyRange.upperOpen

  keyPath.forEach((fieldPath, index) => {
    let fieldLowerBound = lowerBound ? lowerBound[index] : undefined
    let fieldUpperBound = upperBound ? upperBound[index] : undefined
    let fieldRange = KeyRange.bound(
      fieldLowerBound,
      fieldUpperBound,
      lowerBoundOpen,
      upperBoundOpen
    )
    setField(fieldRangeObject, fieldPath, fieldRange)
  })

  return fieldRangeObject
}

/**
 * Sets the specified field, denoted by the specified field path, on the
 * provided object to the provided value.
 *
 * If the specified field path does not exist in the object, it is
 * automatically created by inserting new empty objects.
 *
 * @param {Object} object An object on which the field should be set.
 * @param {string} fieldPath A field path on which the value should be set. A
 *        field path is a sequence of field names joined by dots ({@code "."}).
 * @param {*} value The value to set at the specified field path.
 * @throws {Error} Thrown if the field path is already present or in a conflict
 *         with another already present field path.
 */
function setField(object, fieldPath, value) {
  let parts = fieldPath.split(".")
  let done = []
  let currentObject = object

  while (parts.length) {
    let field = parts.shift()

    if (!parts.length) {
      if (currentObject.hasOwnProperty(field)) {
        throw new Error(`The ${fieldPath} field seems to be already present `)
      }
      currentObject[field] = value
      break
    }

    if (!currentObject.hasOwnProperty(field)) {
      currentObject[field] = {}
    }

    if (!(currentObject[field] instanceof Object)) {
      throw new Error(`The ${fieldPath} field is in a conflict with the ` +
          `${done.join(".")} field`)
    }

    currentObject = currentObject[field]

    done.push(field)
  }
}

/**
 * Normalizes the provided filter to an {@code undefined}, an
 * {@codelink IDBKeyRange} instance or a filter predicate function.
 *
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
 *        filter A filter to use, as provided by the client code.
 * @param {?(string|string[]) keyPath The key path of the storage. This
 *        parameter is used to optimize field map filters that specify a the
 *        field constraints matching the field paths - such field map filters
 *        will be optimized to an IDBKeyRange.
 * @return {(undefined|IDBKeyRange|function(*): boolean)} Normalized filter.
 */
function normalizeFilter(filter, keyPath) {
  if (keyPath) {
    let normalizedFilter = convertFieldMapToKeyRange(filter, keyPath)
    if (normalizedFilter) {
      filter = normalizedFilter
    }
  }

  if ((filter === null) || (filter === undefined)) {
    return undefined
  }

  let isFieldMap = (filter instanceof Object) &&
      !(filter instanceof Function) &&
      !(filter instanceof IDBKeyRange) &&
      !(filter instanceof Array) &&
      !(filter instanceof Date)
  if (isFieldMap) {
    filter = compileFieldRangeFilter(filter)
  }

  if (!(filter instanceof Function) && !(filter instanceof IDBKeyRange)) {
    filter = KeyRange.only(filter)
  }

  return filter
}

/**
 * Attempts to convert the provided filter to a single {@codelink IDBKeyRange}
 * instance.
 *
 * The conversion is only possible if the filter is a field map filter, field
 * paths in the object match the provided key paths exactly, and the filter
 * does not have a field set to an {@codelink IDBKeyRange} instance.
 *
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)}
 *        filter The filter to convert.
 * @param {(string|string[])} keyPaths The field paths representing the key in
 *        this storage.
 * @return {?IDBKeyRange} The filter represented as a single
 *         {@codelink IDBKeyRange} instance, or {@code null} if the conversion
 *         is not possible.
 */
function convertFieldMapToKeyRange(filter, keyPaths) {
  let isOtherFormOfFilter =
      !(filter instanceof Object) ||
      (filter instanceof Function) ||
      (filter instanceof Array) ||
      (filter instanceof Date) ||
      (filter instanceof IDBKeyRange)
  if (isOtherFormOfFilter) {
    return null
  }

  if (!(keyPaths instanceof Array)) {
    keyPaths = [keyPaths]
  }

  let fieldPaths = getAllFieldPaths(filter)
  if (!fieldPaths) {
    return null
  }

  let isKeyFilter =
      (fieldPaths.length === keyPaths.length) &&
      fieldPaths.every(path => keyPaths.indexOf(path) > -1)
  if (!isKeyFilter) {
    return null
  }

  if (keyPaths.length === 1) {
    return IDBKeyRange.only(getFieldValue(filter, keyPaths[0]))
  }

  return new IDBKeyRange.only(keyPaths.map((keyPath) => {
    getFieldValue(filter, keyPath)
  }))
}

/**
 * Generates an array containing all field paths in the provided object.
 *
 * The method also tests whether any of the leaf field values is an
 * {@codelink IDBKeyRange} instance, in such case the method returns
 * {@code null}.
 *
 * The method is used to determine whether the provided object can be turned
 * into and {@codelink IDBKeyRange} instance for a compound record key, and if
 * so, retrieve all field paths in the object so that its structure can be
 * validated against the field paths of the storage.
 *
 * @param {Object} object The object from which the field paths are to be
 *        extracted.
 * @return {?string[]} All field paths in the provided objects, unless the
 *         object contains a field set to an {@codelink IDBKeyRange} instance.
 */
function getFieldPaths(object, stopOnKeyRange = true) {
  let fieldPaths = []
  fieldPaths.containsKeyRange = false
  generateFieldPaths(object, [])

  return fieldPaths

  function generateFieldPaths(object, parts) {
    Object.keys(object).forEach((fieldName) => {
      let value = object[fieldName]
      if (stopOnKeyRange && (value instanceof IDBKeyRange)) {
        fieldPaths = null
        return
      }

      let isTerminalValue =
          !(value instanceof Object) ||
          (value instanceof Date) ||
          (value instanceof Array)
      fieldPath = parts.slice()
      fieldPath.push(fieldName)

      if (isTerminalValue) {
        fieldPaths.push(fieldPath.join("."))
      } else {
        generateFieldPaths(value, fieldPath)
      }
    })
  }
}

/**
 * Retrieves the value from the provided object at the specified field path.
 *
 * @param {Object} object The object from which the field value is to be
 *        extracted.
 * @param {string} fieldPath The path to the field to retrieve.
 * @param {string=} wholeFieldPath The whole path to the field from the root
 *        object. This parameter is used for debugging when the field path does
 *        not exist in the provided object. Leave this parameter unspecified,
 *        it will be set automatically.
 * @return {*} The value of the specified field.
 * @throw {Error} Thrown if the field path does not exist in the provided
 *        object.
 */
function getFieldValue(object, fieldPath, wholeFieldPath = fieldPath) {
  if (!fieldPath) {
    return object
  }

  let field = fieldPath.split(".").shift()
  if (!object.hasOwnProperty(field)) {
    throw new Error(`The field path ${wholeFieldPath} does not exist in the ` +
        "provided object")
  }

  let remainingPath = fieldPath.substring(field.length + 1)
  return getFieldValue(object[field], remainingPath, wholeFieldPath)
}

/**
 * Compiles the provided map of field names to expected values or value ranges
 * to a predicate function that takes a record and returns {@code true} if the
 * record satisfies the provided field values restrictions.
 *
 * @param {Object<string, (number|string|Date|Array|IDBKeyRange)>} filter A map
 *        of field names to expected values or key ranges representing the
 *        expected values for those fields.
 * @return {function(*): boolean} The compiled filter.
 */
function compileFieldRangeFilter(filter) {
  let fieldPaths = getFieldPaths(filter, false)

  let fieldFilters = fieldPaths.map((fieldPath) => {
    let fieldRange = getFieldValue(filter, fieldPath)
    if (!(fieldRange instanceof IDBKeyRange)) {
      fieldRange = KeyRange.only(fieldRange)
    }

    return (record) => {
      let fieldValue = getFieldValue(record, fieldPath)

      if (fieldRange.lower !== undefined) {
        let lowerComparison
        lowerComparison = indexedDB.cmp(fieldRange.lower, fieldValue)

        let failedTest = (lowerComparison > 0) ||
            (fieldRange.lowerOpen && (lowerComparison === 0))
        if (failedTest) {
          return false
        }
      }

      if (fieldRange.upper !== undefined) {
        let upperComparison
        upperComparison = indexedDB.cmp(fieldRange.upper, fieldValue)

        let failedTest = (lowerComparison < 0) ||
            (fieldRange.upperOpen && (lowerComparison === 0))
        if (failedTest) {
          return false
        }
      }

      return true
    }
  })

  return (record) => {
    if (!(record instanceof Object)) {
      return false
    }

    return fieldFilters.every(fieldFilter => fieldFilter(record))
  }
}
