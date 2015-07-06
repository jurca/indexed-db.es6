
import {idbProvider} from "../NativeDBAccessor"
import CursorDirection from "./CursorDirection"
import {normalizeFilter, compileOrderingFieldPaths, partiallyOptimizeFilter}
    from "./utils"

/**
 * Allowed cursor direction values.
 */
const CURSOR_DIRECTIONS = Object.freeze([
  CursorDirection.NEXT,
  CursorDirection.PREVIOUS,
  "NEXT",
  "PREVIOUS",
  "PREV"
])

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
 * The sorting and filtering can be optimized by this method if the field
 * paths match the key path of the object store or the index - so the method
 * can utilize the key ranges and / or the order (implicit or reversed) of
 * the records provided by the object store or its index.
 * 
 * The methods first checks whether it can run the query on this object store
 * and optimize the record sorting and filtering. If it cannot, it checks
 * whether it can optimize the record sorting and filtering by using any of
 * the object store's indexes.
 * 
 * If both the filtering and sorting cannot be optimized, the method attempts
 * to optimize either the sorting or filtering (preferring optimizing the
 * sorting over filtering), and preferably using this object store instead
 * of its indexes.
 * 
 * The method executes the query on this object store if neither the filtering
 * nor sorting can be optimized.
 * 
 * Note that if the sorting cannot be optimized, the method can execute the
 * callback on the provided records only after it traverses all records
 * matching the filter.
 * 
 * In such case, the method keeps the semi-constructed result in a sorted array
 * of up to {@code offset + limit} elements, inserts the current record using
 * the insert sort algorithm optimized using the binary search algorithm and
 * trims the end of the array if its length exceeds the {@code offset + limit}
 * limit. This results in {@code O(n log c)} complexity, for {@code c} being
 * the {@code offset + limit} and {@code n} being the total number records.
 * 
 * @param {ReadOnlyObjectStore} objectStore The object store on which the query
 *        should be executed
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
 *        The filter, restricting the records returned by this method. If a
 *        function is provided, the first argument will be set to the record
 *        and the second argument will be set to the primary key of the record.
 * @param {?(CursorDirection|string|string[]|function(*, *): number)} order How
 *        the resulting records should be sorted. This can be one of the
 *        following:
 *        - a {@code CursorDirection} constant, either {@code NEXT} or
 *          {@code PREVIOUS} for ascending or descending order respectively
 *        - {@code null} as alias for {@code CursorDirection.NEXT}
 *        - one of the {@code "NEXT"} (alias for {@code CursorDirection.NEXT}),
 *          {@code "PREVIOUS"} or {@code "PREV"} (aliases for
 *          {@code CursorDirection.PREVIOUS})
 *        - a string containing a field path, meaning the records should be
 *          sorted by the values of the denoted field (note that the field must
 *          exist in all records and its value must be a valid IndexedDB key
 *          value).
 *          The order is ascending by default, use the {@code "!" prefix} for
 *          descending order.
 *          To sort by a field named {@code NEXT}, {@code PREVIOUS} or
 *          {@code PREV} wrap the field path into an array containing the
 *          field path.
 *        - an array of field paths, as described above. The records will be
 *          sorted by the values of the specified fields lexicographically.
 *        - a comparator function compatible with the
 *          {@codelink Array.prototype.sort} method.
 * @param {number} offset The index of the first record to include in the
 *        result. The records are numbered from {@code 0}, the offset must be a
 *        non-negative integer.
 * @param {?number} limit The maximum number of records to return as a result.
 *        The limit must be a positive integer, or {@code null} if no limit
 *        should be imposed.
 * @param {function(*, (number|string|Date|Array))} callback Callback to
 *        execute on every iterated record that matches the query.
 * @return {PromiseSync<undefined>} A promise that resolves when the query has
 *         been executed.
 */
export default function executeQuery(objectStore, filter, order, offset, limit,
    callback) {
  if ((offset < 0) || (Math.floor(offset) !== offset)) {
    throw new Error("The offset must be a non-negative integer, " +
        `${offset} provided`)
  }
  if ((limit !== null) && ((limit <= 0) || (Math.floor(limit) !== limit))) {
    throw new Error("The limit must be a positive integer or null, " +
        `${limit} provided`)
  }

  let keyRange = undefined
  let direction
  let comparator = null
  let storage = objectStore

  order = prepareOrderingSpecificationForQuery(order, objectStore.keyPath)
  if (order instanceof Function) {
    direction = CursorDirection.NEXT
    comparator = order

    filter = normalizeFilter(filter, storage.keyPath)
    if (!(filter instanceof Function)) {
      keyRange = filter
      filter = null
    }
  } else {
    let preparedQuery = prepareQuery(storage, filter, order)
    ;({ storage, direction, comparator, keyRange, filter } = preparedQuery)
  }
  
  return runQuery(
    storage.createCursorFactory(keyRange, direction),
    filter,
    comparator,
    offset,
    limit,
    callback
  )
}

/**
 * Executes the specified query using the provided cursor factory.
 * 
 * Note that the callback will be executed on the records only after all
 * records have been populated if the comparator if a function so the records
 * are passed to the callback in the right order.
 * 
 * @param {function(function(ReadyOnlyCursor)): number} cursorFactory The
 *        cursor factory to use to create a cursor for executing the query.
 * @param {?function(*, (number|string|Date|Array)): boolean} filter Optional
 *        custom filter callback.
 * @param {?function(*, *): number} comparator Optional record comparator to
 *        use to sort the records in the result.
 * @param {number} offset The index of the first record to include in the
 *        result. The records are numbered from {@code 0}, the offset must be
 *        a non-negative integer.
 * @param {?number} limit The maximum number of records to return as a result.
 *        The limit must be a positive integer, or {@code null} if no limit
 *        should be imposed.
 * @param {function(*, (number|string|Date|Array))} callback Callback to
 *        execute on every iterated record that matches the query.
 * @return {PromiseSync<undefined>} A promise that resolves when the query has
 *         been executed.
 */
function runQuery(cursorFactory, filter, comparator, offset, limit, callback) {
  let records = []
  let recordIndex = -1

  return cursorFactory((cursor) => {
    if (!filter && offset && ((recordIndex + 1) < offset)) {
      recordIndex = offset - 1
      cursor.advance(offset)
      return
    }
    
    let primaryKey = cursor.primaryKey
    if (filter && !filter(cursor.record, primaryKey)) {
      cursor.continue()
      return
    }
    
    if (comparator) {
      insertSorted(records, cursor.record, primaryKey, comparator)
      if (offset || limit) {
        if (records.length > (offset + limit)) {
          records.pop()
        }
      }
      
      cursor.continue()
      return
    }
    
    recordIndex++
    if (recordIndex < offset) {
      cursor.continue()
      return
    }
    
    callback(cursor.record, primaryKey)
    
    if (!limit || ((recordIndex + 1) < (offset + limit))) {
      cursor.continue()
    }
  }).then(() => {
    if (!comparator) {
      return
    }
    
    records = records.slice(offset)
    for (let { record, primaryKey } of records) {
      callback(record, primaryKey)
    }
  })
}

/**
 * Inserts the provided record into the sorted array of records and their
 * primary keys, keeping it sorted.
 * 
 * @param {{record: *, primaryKey: (number|string|Date|Array)}[]} records The
 *        array of records into which the provided record should be inserted.
 * @param {*} record The record to insert into the records array.
 * @param {(number|string|Date|Array)} primaryKey The primary key of the
 *        record.
 * @param {function(*, *): number} comparator Record comparator by which the
 *        array is sorted. The comparator is a standard comparator function
 *        compatible with the {@linkcode Array.prototype.sort} method.
 */
function insertSorted(records, record, primaryKey, comparator) {
  let index = findInsertIndex(records, record, comparator)
  records.splice(index, 0, {
    record,
    primaryKey
  })
}

/**
 * Uses the binary search algorithm to find the index at which the specified
 * record should be inserted into the specified array of records to keep the
 * array sorted according to the provided comparator.
 * 
 * @param {{record: *, primaryKey: (number|string|Date|Array)}[]} records The
 *        array of records into which the provided record should be inserted.
 * @param {*} record The record to insert into the records array.
 * @param {function(*, *): number} comparator Record comparator by which the
 *        array is sorted. The comparator is a standard comparator function
 *        compatible with the {@linkcode Array.prototype.sort} method.
 * @return {number} The index at which the record should be inserted to keep
 *         the array of records sorted.
 */
function findInsertIndex(records, record, comparator) {
  if (!records.length) {
    return 0
  }
  
  if (records.length === 1) {
    let comparison = comparator(records[0].record, record)
    return (comparison > 0) ? 0 : 1
  }
  
  let comparison = comparator(records[0].record, record)
  if (comparison > 0) {
    return 0
  }
  
  let bottom = 1
  let top = records.length - 1
  
  while (bottom <= top) {
    let pivotIndex = Math.floor((bottom + top) / 2)
    
    let comparison = comparator(records[pivotIndex].record, record)
    if (comparison > 0) {
      let previousElement = records[pivotIndex - 1].record
      if (comparator(previousElement, record) <= 0) {
        return pivotIndex
      }
      
      top = pivotIndex - 1
    } else {
      bottom = pivotIndex + 1
    }
  }
  
  return records.length
}

/**
 * Prepares the query that uses the specified filter and record order for
 * execution on this storage.
 * 
 * The method attempts uses a heuristic to determine whether the query should
 * be run directly on this object store or on one of its indexes for maximum
 * performance.
 * 
 * If the method cannot optimize sorting and filtering, it prefers optimizing
 * sorting to optimizing filtering, as optimizing sorting allows the query
 * executor to skip the requested amount of records and the records following
 * the last record that fills the required amount of records.
 * 
 * If the sorting cannot be optimized, the method attempts to optimize
 * filtering so that the matching records can be selected by providing a key
 * range to cursor, so that only the matching records will be traversed.
 * 
 * The method constructs the filtering predicate and sorting comparator if
 * neither the sorting nor filtering can be optimized, and prepares the query
 * to be executed directly on the object store.
 * 
 * @param {ReadOnlyObjectStore} thisStorage This object store.
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
 *        The filter, restricting the records returned by this method. If a
 *        function is provided, the first argument will be set to the record
 *        and the second argument will be set to the primary key of the record.
 * @param {(string|string[])} order Field paths by which the records should be
 *        sorted. A field path may be prefixed by an exclamation mark
 *        ({@code "!"}) for descending order.
 * @return {{storage: AbstractReadOnlyStorage, direction: CursorDirection, comparator: ?function(*, *): number, keyRange: (undefined|IDBKeyRange), filter: (undefined|function(*, (number|string|Date|Array)): boolean)}}
 *         The storage on which the query should be executed, the direction in
 *         which the cursor should be opened and the record comparator to use
 *         to additionally sort the fetched records matching the filter.
 *         Finally, the returned object has the {@code keyRange} and
 *         {@code filter} fields set to the key range and custom filter to use
 *         with the storage to run the query.
 */
function prepareQuery(thisStorage, filter, order) {
  order = normalizeKeyPath(order)
  
  let expectedSortingDirection = order[0].charAt(0) === "!"
  let canSortingBeOptimized
  canSortingBeOptimized = canOptimizeSorting(expectedSortingDirection, order)
  
  let storages = new Map()
  storages.set(normalizeKeyPath(thisStorage.keyPath), {
    storage: thisStorage,
    score: 1 // traversing storage is faster than fetching records by index
  })
  
  for (let indexName of thisStorage.indexNames) {
    let index = thisStorage.getIndex(indexName)
    if (!index.multiEntry) {
      storages.set(normalizeKeyPath(index.keyPath), {
        storage: index,
        score: 0
      })
    }
  }
  
  let simplifiedOrderFieldPaths = simplifyOrderingFieldPaths(order)
  
  if (canSortingBeOptimized) {
    prepareSortingOptimization(storages, simplifiedOrderFieldPaths)
  }

  prepareFilteringOptimization(storages, filter)
  
  return chooseStorageForQuery(
    storages,
    order,
    simplifiedOrderFieldPaths,
    canSortingBeOptimized,
    expectedSortingDirection
  )
}

/**
 * Calculates the best possible sorting optimization for the provided storages,
 * updating the provided map with sorting optimization scores for each storage.
 *
 * @param {Map<string[], {storage: AbstractReadOnlyStorage, score: number, keyRange: (undefined|IDBKeyRange), filter: ?function(*, (number|string|Date|Array)): boolean}>} storages
 *        Map of storage key paths to storages and information related to how
 *        the query would be executed on each of them, including the
 *        performance optimization score (the higher is better).
 * @param {string[]} simplifiedOrderFieldPaths Ordering field paths with the
 *        exclamation mark prefix stripped from them.
 */
function prepareSortingOptimization(storages, simplifiedOrderFieldPaths) {
  let idb = idbProvider()
  for (let [keyPath, storageAndScore] of storages) {
    let keyPathSlice = keyPath.slice(0, simplifiedOrderFieldPaths.length)
    if (idb.cmp(keyPathSlice, simplifiedOrderFieldPaths) === 0) {
      storageAndScore.score += 4 // optimizing the sorting is more important
    }
  }
}

/**
 * Calculates the best possible filtering optimizations for the provided
 * storages, updating the provided map with optimized filtering info and
 * optimization score for each storage.
 *
 * @param {Map<string[], {storage: AbstractReadOnlyStorage, score: number, keyRange: (undefined|IDBKeyRange), filter: ?function(*, (number|string|Date|Array)): boolean}>} storages
 *        Map of storage key paths to storages and information related to how
 *        the query would be executed on each of them, including the
 *        performance optimization score (the higher is better).
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array)): boolean)=} filter
 *        The filter, restricting the records returned by this method. If a
 *        function is provided, the first argument will be set to the record
 *        and the second argument will be set to the primary key of the record.
 */
function prepareFilteringOptimization(storages, filter) {
  if (filter instanceof Function) {
    for (let [keyPath, storageAndScore] of storages) {
      storageAndScore.filter = filter
    }

    return
  }

  for (let [keyPath, storageAndScore] of storages) {
    let normalizedFilter = normalizeFilter(filter, keyPath)
    if (normalizedFilter instanceof Function) {
      let isOptimizableFilter =
          (filter instanceof Object) &&
          !(filter instanceof Date) &&
          !(filter instanceof Array) &&
          !(filter instanceof IDBKeyRange)
      if (isOptimizableFilter) {
        let partialOptimization = partiallyOptimizeFilter(filter, keyPath)
        storageAndScore.keyRange = partialOptimization.keyRange
        storageAndScore.filter = partialOptimization.filter
        if (partialOptimization.score) {
          storageAndScore.score += 1 + partialOptimization.score
        }
      } else {
        storageAndScore.filter = normalizedFilter
      }
    } else {
      storageAndScore.keyRange = normalizedFilter
      storageAndScore.score += 2
    }
  }
}

/**
 * Selects the storage on which the execute a query that should lead to the
 * best possible performance. The method returns all the data necessary to
 * execute the query.
 *
 * @param {Map<string[], {storage: AbstractReadOnlyStorage, score: number, keyRange: (undefined|IDBKeyRange), filter: ?function(*, (number|string|Date|Array)): boolean}>} storages
 *        Map of storage key paths to storages and information related to how
 *        the query would be executed on each of them, including the
 *        performance optimization score (the higher is better).
 * @param {string[]} order Field paths by which the records should be sorted. A
 *        field path may be prefixed by an exclamation mark ({@code "!"}) for
 *        descending order.
 * @param {string[]} simplifiedOrderFieldPaths Ordering field paths with the
 *        exclamation mark prefix stripped from them.
 * @param {boolean} canSortingBeOptimized Set to {@code true} if sorting
 *        optimization is possible.
 * @param {boolean} expectedSortingDirection Set to {@code true} for descending
 *        order, set to {@code false} for ascending order.
 * @return {{storage: AbstractReadOnlyStorage, direction: CursorDirection, comparator: ?function(*, *): number, keyRange: (undefined|IDBKeyRange), filter: (undefined|function(*, (number|string|Date|Array)): boolean)}}
 *         The storage on which the query should be executed, the direction in
 *         which the cursor should be opened and the record comparator to use
 *         to additionally sort the fetched records matching the filter.
 *         Finally, the returned object has the {@code keyRange} and
 *         {@code filter} fields set to the key range and custom filter to use
 *         with the storage to run the query.
 */
function chooseStorageForQuery(storages, order, simplifiedOrderFieldPaths,
    canSortingBeOptimized, expectedSortingDirection) {
  let sortedStorages = Array.from(storages.values())
  sortedStorages.sort((storage1, storage2) => {
    return storage2.score - storage1.score
  })

  let chosenStorageDetails = sortedStorages[0]
  let chosenStorage = chosenStorageDetails.storage
  let chosenStorageKeyPath = normalizeKeyPath(chosenStorage.keyPath)
  let storageKeyPathSlice = chosenStorageKeyPath.slice(
    0,
    simplifiedOrderFieldPaths.length
  )
  let optimizeSorting = canSortingBeOptimized &&
      (idbProvider().cmp(storageKeyPathSlice, simplifiedOrderFieldPaths) === 0)

  return {
    storage: chosenStorage,
    direction: optimizeSorting ? (
    CursorDirection[expectedSortingDirection ? "PREVIOUS" : "NEXT"]
    ) : CursorDirection.NEXT,
    comparator: optimizeSorting ? null : compileOrderingFieldPaths(order),
    keyRange: chosenStorageDetails.keyRange,
    filter: chosenStorageDetails.filter
  }
}

/**
 * Simplifies the provided ordering field paths by stripping their direction
 * prefix (if present). This allows for comparing with storage key paths.
 * 
 * @param {string[]} order The ordering field paths specifying how the records
 *        should be sorted.
 * @return {string[]} Raw field paths compatible with storage key paths.
 */
function simplifyOrderingFieldPaths(order) {
  return order.map((fieldPath) => {
    return fieldPath.replace(/^!/, "")
  })
}

/**
 * Determines whether the sorting of the query result can be done through an
 * index (provided such index exists) or the natural order of the records in
 * the object store.
 *
 * @param {boolean} expectedSortingDirection The sorting direction that is
 *        expected from all sort-by fields so that the sorting can be
 *        optimized. {@code true} represents descending order, {@code false}
 *        represents ascending order.
 * @param {string[]} order Ordering field paths specifying how the records
 *        should be sorted.
 * @return {boolean} {@code true} if the sorting can be optimized, if an
 *         appropriate index exists or the natural order of the records in the
 *         object store matches the order denoted by the field paths.
 */
function canOptimizeSorting(expectedSortingDirection, order) {
  for (let orderingFieldPath of order) {
    if ((orderingFieldPath.charAt(0) === "!") !== expectedSortingDirection) {
      return false
    }
  }
  
  return true
}

/**
 * Preprocess the raw ordering specification into form that can be used in
 * query optimization.
 * 
 * @param {?(CursorDirection|string|string[]|function(*, *): number)} order How
 *        the resulting records should be sorted. This can be one of the
 *        following:
 *        - a {@code CursorDirection} constant, either {@code NEXT} or
 *          {@code PREVIOUS} for ascending or descending order respectively
 *        - {@code null} as alias for {@code CursorDirection.NEXT}
 *        - one of the {@code "NEXT"} (alias for {@code CursorDirection.NEXT}),
 *          {@code "PREVIOUS"} or {@code "PREV"} (aliases for
 *          {@code CursorDirection.PREVIOUS})
 *        - a string containing a field path, meaning the records should be
 *          sorted by the values of the denoted field (note that the field
 *          must exist in all records and its value must be a valid IndexedDB
 *          key value).
 *          The order is ascending by default, use the {@code "!" prefix} for
 *          descending order.
 *          To sort by a field named {@code NEXT}, {@code PREVIOUS} or
 *          {@code PREV} wrap the field path into an array containing the field
 *          path.
 *        - an array of field paths, as described above. The records will be
 *          sorted by the values of the specified fields lexicographically.
 *        - a comparator function compatible with the
 *          {@linkcode Array.prototype.sort} method.
 * @param {(string|string[])} keyPath The key path of this object store.
 * @return {(string[]|function(*, *): number)} Prepared ordering specification
 *         ready to be used in query optimization.
 */
function prepareOrderingSpecificationForQuery(order, keyPath) {
  if (order === null) {
    order = CursorDirection.NEXT
  }
  
  let isCursorDirection = ((typeof order === "string") &&
      (CURSOR_DIRECTIONS.indexOf(order.toUpperCase()) > -1)) ||
      (CURSOR_DIRECTIONS.indexOf(order) > -1)
  if (isCursorDirection && (typeof order === "string")) {
    order = CursorDirection[order.toUpperCase()] || CursorDirection.PREVIOUS
  }
  
  if (order instanceof CursorDirection) {
    keyPath = normalizeKeyPath(keyPath)
    
    if (order === CursorDirection.NEXT) {
      return keyPath
    } else {
      return keyPath.map(fieldPath => `!${fieldPath}`)
    }
  }
  
  return order
}

/**
 * Normalized the provided key path into an array of field paths.
 * 
 * @param {(string|string[])} keyPath The key path to normalize.
 * @return {string[]} The normalized key path.
 */
function normalizeKeyPath(keyPath) {
  if (typeof keyPath === "string") {
    return [keyPath]
  }
  
  return keyPath
}
