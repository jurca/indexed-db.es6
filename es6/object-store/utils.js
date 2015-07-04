
import KeyRange from "./KeyRange"

/**
 * Converts the provided key range object into a field range map object.
 *
 * @param {IDBKeyRange} keyRange The key range object to convert.
 * @param {(string|string[])} keyPath The key path of this storage.
 * @return {Object<string, IDBKeyRange>} A field range map object.
 */
export function keyRangeToFieldRangeObject(keyRange, keyPath) {
  let fieldRangeObject = {}

  if (!(keyPath instanceof Array)) {
    setFieldValue(fieldRangeObject, keyPath, keyRange)
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
    setFieldValue(fieldRangeObject, fieldPath, fieldRange)
  })

  return fieldRangeObject
}

/**
 * Normalizes the provided filter to an {@code undefined}, an
 * {@codelink IDBKeyRange} instance or a filter predicate function.
 *
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)} filter
 *        A filter to use, as provided by the client code.
 * @param {?(string|string[])} keyPath The key path of the storage. This
 *        parameter is used to optimize field map filters that specify a the
 *        field constraints matching the field paths - such field map filters
 *        will be optimized to an IDBKeyRange.
 * @return {(undefined|IDBKeyRange|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)} Normalized filter.
 */
export function normalizeFilter(filter, keyPath) {
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
 * Compiles the provided map of field names to expected values or value ranges
 * to a predicate function that takes a record and returns {@code true} if the
 * record satisfies the provided field values restrictions.
 *
 * @param {Object<string, (number|string|Date|Array|IDBKeyRange)>} filter A map
 *        of field names to expected values or key ranges representing the
 *        expected values for those fields.
 * @return {function(*): boolean} The compiled filter.
 */
export function compileFieldRangeFilter(filter) {
  let fieldPaths = getFieldPaths(filter, false)

  let fieldFilters = fieldPaths.map((fieldPath) => {
    let fieldRange = getFieldValue(filter, fieldPath)
    if (!(fieldRange instanceof IDBKeyRange)) {
      fieldRange = KeyRange.only(fieldRange)
    }

    return (record) => {
      let fieldValue;
      try {
        fieldValue = getFieldValue(record, fieldPath)
      } catch (error) {
        return false // the field does not exist in the record
      }

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

        let failedTest = (upperComparison < 0) ||
            (fieldRange.upperOpen && (upperComparison === 0))
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

/**
 * Compiles the provided sequence of ordering field paths to a comparator
 * function that relies on the native {@code indexedDB.cmp} method.
 * 
 * The created comparator evaluates the field paths on the provided values in
 * the same order they were specified. The resulting values are then compared
 * using the native {@code indexedDB.cmp} method. The comparator then returns
 * the comparison, unless the values are equal - in such case the comparator
 * moves to the next field path unless there are no more field paths left.
 * 
 * @param {(string|string[])} orderingFieldPaths The field path(s) to compile
 *        into a comparator function. A field path may be prefixed by an
 *        exclamation mark ({@code "!"}) for the reverse order.
 * @return {function(*, *): number} The compiled comparator function.
 */
export function compileOrderingFieldPaths(orderingFieldPaths) {
  if (typeof orderingFieldPaths === "string") {
    orderingFieldPaths = [orderingFieldPaths]
  }
  
  let inverted = []
  let getters = []
  
  for (let fieldPath of orderingFieldPaths) {
    if (fieldPath.charAt(0) === "!") {
      inverted.push(true)
      getters.push(compileFieldGetter(fieldPath.substring(1)))
    } else {
      inverted.push(false)
      getters.push(compileFieldGetter(fieldPath))
    }
  }
  
  let gettersCount = getters.length
  
  return (record1, record2) => {
    for (let i = 0; i < gettersCount; i++) {
      let getter = getters[i]
      let value1 = getter(record1)
      let value2 = getter(record2)
      
      let comparison
      if (inverted[i]) {
        comparison = indexedDB.cmp(value2, value1)
      } else {
        comparison = indexedDB.cmp(value1, value2)
      }
      
      if (comparison !== 0) {
        return comparison
      }
    }
    
    return 0
  }
}

/**
 * Compiles the provided field path to a function that retrieves the value of
 * the field denoted by the field path from the object passed to the function,
 * or {@code undefined} if the field does not exist in the object.
 * 
 * @param {string} fieldPath The field path to compile.
 * @return {function(*): *} The compiled field getter.
 */
function compileFieldGetter(fieldPath) {
  let fields = fieldPath.split(".")
  
  return (record) => {
    let value = record
    
    for (let field of fields) {
      if (!(value instanceof Object) || !value.hasOwnProperty(field)) {
        return undefined
      }
      
      value = value[field]
    }
    
    return value
  }
}

/**
 * Attempts to convert the provided filter to a single {@codelink IDBKeyRange}
 * instance.
 *
 * The conversion is only possible if the filter is a field map filter, field
 * paths in the object match the provided key paths exactly, and the filter
 * does not have a field set to an {@codelink IDBKeyRange} instance.
 *
 * @param {?(undefined|number|string|Date|Array|IDBKeyRange|Object<string, (number|string|Date|Array|IDBKeyRange)>|function(*, (number|string|Date|Array), (number|string|Date|Array)): boolean)} filter
 *        The filter to convert.
 * @param {(string|string[])} keyPaths The field paths representing the key in
 *        this storage.
 * @return {?IDBKeyRange} The filter represented as a single
 *         {@linkcode IDBKeyRange} instance, or {@code null} if the conversion
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

  let fieldPaths = getFieldPaths(filter)
  if (!fieldPaths) {
    return null
  }

  let isKeyFilter =
      (fieldPaths.length === keyPaths.length) &&
      fieldPaths.every(path => keyPaths.indexOf(path) > -1)
  if (!isKeyFilter) {
    return null
  }

  let containsKeyRanges = keyPaths.some((keyPath) => {
    return getFieldValue(filter, keyPath) instanceof IDBKeyRange
  })
  if (containsKeyRanges) {
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
 * {@linkcode IDBKeyRange} instance, in such case the method returns
 * {@code null}.
 *
 * The method is used to determine whether the provided object can be turned
 * into and {@linkcode IDBKeyRange} instance for a compound record key, and if
 * so, retrieve all field paths in the object so that its structure can be
 * validated against the field paths of the storage.
 *
 * @param {Object} object The object from which the field paths are to be
 *        extracted.
 * @param {boolean=} stopOnKeyRange When {@code true}, the method returns
 *        {@code null} if it encounters a key range.
 * @return {?string[]} All field paths in the provided objects, unless the
 *         object contains a field set to an {@linkcode IDBKeyRange} instance.
 */
function getFieldPaths(object, stopOnKeyRange = true) {
  let fieldPaths = []
  fieldPaths.containsKeyRange = false
  generateFieldPaths(object, [])

  return fieldPaths

  function generateFieldPaths(object, parts) {
    Object.keys(object).some((fieldName) => {
      let value = object[fieldName]
      if (stopOnKeyRange && (value instanceof IDBKeyRange)) {
        fieldPaths = null
        return true
      }

      let isTerminalValue =
          !(value instanceof Object) ||
          (value instanceof Date) ||
          (value instanceof Array) ||
          (value instanceof IDBKeyRange)
      let fieldPath = parts.slice()
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
function setFieldValue(object, fieldPath, value) {
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
 * Retrieves the value from the provided object at the specified field path.
 *
 * @param {Object} object The object from which the field value is to be
 *        extracted.
 * @param {string} fieldPath The path to the field to retrieve, specified as a
 *        sequence of field names joined by dots ({@code "."}).
 * @return {*} The value of the specified field.
 * @throw {Error} Thrown if the field path does not exist in the provided
 *        object.
 */
function getFieldValue(object, fieldPath) {
  if (!fieldPath) {
    return object
  }

  let currentObject = object
  fieldPath.split(".").forEach((fieldName) => {
    if (!currentObject.hasOwnProperty(fieldName)) {
      throw new Error(`The field path ${fieldPath} does not exist in the ` +
          "provided object")
    }

    currentObject = currentObject[fieldName]
  })

  return currentObject
}
