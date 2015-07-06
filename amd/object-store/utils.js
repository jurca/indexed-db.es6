define(["../NativeDBAccessor", "./KeyRange"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var idbProvider = $__0.idbProvider;
  var KeyRange = $__2.default;
  function keyRangeToFieldRangeObject(keyRange, keyPath) {
    var fieldRangeObject = {};
    if (!(keyPath instanceof Array)) {
      setFieldValue(fieldRangeObject, keyPath, keyRange);
      return fieldRangeObject;
    }
    var lowerBound = keyRange.lower;
    var upperBound = keyRange.upper;
    var lowerBoundOpen = keyRange.lowerOpen;
    var upperBoundOpen = keyRange.upperOpen;
    keyPath.forEach(function(fieldPath, index) {
      var fieldLowerBound = lowerBound ? lowerBound[index] : undefined;
      var fieldUpperBound = upperBound ? upperBound[index] : undefined;
      var fieldRange = KeyRange.bound(fieldLowerBound, fieldUpperBound, lowerBoundOpen, upperBoundOpen);
      setFieldValue(fieldRangeObject, fieldPath, fieldRange);
    });
    return fieldRangeObject;
  }
  function normalizeFilter(filter, keyPath) {
    if (keyPath) {
      var normalizedFilter = convertFieldMapToKeyRange(filter, keyPath);
      if (normalizedFilter) {
        filter = normalizedFilter;
      }
    }
    if ((filter === null) || (filter === undefined)) {
      return undefined;
    }
    var isFieldMap = (filter instanceof Object) && !(filter instanceof Function) && !(filter instanceof IDBKeyRange) && !(filter instanceof Array) && !(filter instanceof Date);
    if (isFieldMap) {
      filter = compileFieldRangeFilter(filter);
    }
    if (!(filter instanceof Function) && !(filter instanceof IDBKeyRange)) {
      filter = KeyRange.only(filter);
    }
    return filter;
  }
  function partiallyOptimizeFilter(filter, keyPath) {
    var fieldPaths = getFieldPaths(filter, false);
    var canOptimize = keyPath.every(function(path) {
      return fieldPaths.indexOf(path) > -1;
    });
    if (!canOptimize) {
      return {
        keyRange: undefined,
        filter: compileFieldRangeFilter(filter),
        score: 0
      };
    }
    if (keyPath.length === fieldPaths.length) {
      return partiallyOptimizeKeyPathMatchingFilter(filter, keyPath);
    }
    var keyPathContainsKeyRange = keyPath.some(function(fieldPath) {
      return getFieldValue(filter, fieldPath) instanceof IDBKeyRange;
    });
    if (keyPathContainsKeyRange) {
      return {
        keyRange: undefined,
        filter: compileFieldRangeFilter(filter),
        score: 0
      };
    }
    var $__11 = splitFilteringObject(filter, fieldPaths, keyPath),
        fieldsToOptimize = $__11.fieldsToOptimize,
        fieldsToCompile = $__11.fieldsToCompile;
    return {
      keyRange: convertFieldMapToKeyRange(fieldsToOptimize, keyPath),
      filter: compileFieldRangeFilter(fieldsToCompile),
      score: keyPath.length / fieldPaths.length
    };
  }
  function partiallyOptimizeKeyPathMatchingFilter(filter, keyPath) {
    var keyRange = convertFieldMapToKeyRange(filter, keyPath);
    if (!keyRange) {
      return {
        keyRange: undefined,
        filter: compileFieldRangeFilter(filter),
        score: 0
      };
    }
    return {
      keyRange: keyRange,
      filter: null,
      score: 1
    };
  }
  function splitFilteringObject(filter, filterFieldPaths, storageKeyPath) {
    var fieldsToOptimize = {};
    var fieldsToCompile = {};
    filterFieldPaths.forEach(function(fieldPath) {
      var value = getFieldValue(filter, fieldPath);
      if (storageKeyPath.indexOf(fieldPath) > -1) {
        setFieldValue(fieldsToOptimize, fieldPath, value);
      } else {
        setFieldValue(fieldsToCompile, fieldPath, value);
      }
    });
    return {
      fieldsToOptimize: fieldsToOptimize,
      fieldsToCompile: fieldsToCompile
    };
  }
  function compileFieldRangeFilter(filter) {
    var fieldPaths = getFieldPaths(filter, false);
    var idb = idbProvider();
    var fieldFilters = fieldPaths.map(function(fieldPath) {
      var fieldRange = getFieldValue(filter, fieldPath);
      if (!(fieldRange instanceof IDBKeyRange)) {
        fieldRange = KeyRange.only(fieldRange);
      }
      return function(record) {
        var fieldValue;
        try {
          fieldValue = getFieldValue(record, fieldPath);
        } catch (error) {
          return false;
        }
        if (fieldRange.lower !== undefined) {
          var lowerComparison;
          lowerComparison = idb.cmp(fieldRange.lower, fieldValue);
          var failedTest = (lowerComparison > 0) || (fieldRange.lowerOpen && (lowerComparison === 0));
          if (failedTest) {
            return false;
          }
        }
        if (fieldRange.upper !== undefined) {
          var upperComparison;
          upperComparison = idb.cmp(fieldRange.upper, fieldValue);
          var failedTest$__12 = (upperComparison < 0) || (fieldRange.upperOpen && (upperComparison === 0));
          if (failedTest$__12) {
            return false;
          }
        }
        return true;
      };
    });
    return function(record) {
      if (!(record instanceof Object)) {
        return false;
      }
      return fieldFilters.every(function(fieldFilter) {
        return fieldFilter(record);
      });
    };
  }
  function compileOrderingFieldPaths(orderingFieldPaths) {
    if (typeof orderingFieldPaths === "string") {
      orderingFieldPaths = [orderingFieldPaths];
    }
    var inverted = [];
    var getters = [];
    var $__7 = true;
    var $__8 = false;
    var $__9 = undefined;
    try {
      for (var $__5 = void 0,
          $__4 = (orderingFieldPaths)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
        var fieldPath = $__5.value;
        {
          if (fieldPath.charAt(0) === "!") {
            inverted.push(true);
            getters.push(compileFieldGetter(fieldPath.substring(1)));
          } else {
            inverted.push(false);
            getters.push(compileFieldGetter(fieldPath));
          }
        }
      }
    } catch ($__10) {
      $__8 = true;
      $__9 = $__10;
    } finally {
      try {
        if (!$__7 && $__4.return != null) {
          $__4.return();
        }
      } finally {
        if ($__8) {
          throw $__9;
        }
      }
    }
    var idb = idbProvider();
    var gettersCount = getters.length;
    return function(record1, record2) {
      for (var i = 0; i < gettersCount; i++) {
        var getter = getters[i];
        var value1 = getter(record1);
        var value2 = getter(record2);
        var comparison;
        if (inverted[i]) {
          comparison = idb.cmp(value2, value1);
        } else {
          comparison = idb.cmp(value1, value2);
        }
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    };
  }
  function compileFieldGetter(fieldPath) {
    var fields = fieldPath.split(".");
    return function(record) {
      var value = record;
      var $__7 = true;
      var $__8 = false;
      var $__9 = undefined;
      try {
        for (var $__5 = void 0,
            $__4 = (fields)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
          var field = $__5.value;
          {
            if (!(value instanceof Object) || !value.hasOwnProperty(field)) {
              return undefined;
            }
            value = value[field];
          }
        }
      } catch ($__10) {
        $__8 = true;
        $__9 = $__10;
      } finally {
        try {
          if (!$__7 && $__4.return != null) {
            $__4.return();
          }
        } finally {
          if ($__8) {
            throw $__9;
          }
        }
      }
      return value;
    };
  }
  function convertFieldMapToKeyRange(filter, keyPaths) {
    var isOtherFormOfFilter = !(filter instanceof Object) || (filter instanceof Function) || (filter instanceof Array) || (filter instanceof Date) || (filter instanceof IDBKeyRange);
    if (isOtherFormOfFilter) {
      return null;
    }
    if (!(keyPaths instanceof Array)) {
      keyPaths = [keyPaths];
    }
    var fieldPaths = getFieldPaths(filter);
    if (!fieldPaths) {
      return null;
    }
    var isKeyFilter = (fieldPaths.length === keyPaths.length) && fieldPaths.every(function(path) {
      return keyPaths.indexOf(path) > -1;
    });
    if (!isKeyFilter) {
      return null;
    }
    if (keyPaths.length === 1) {
      return IDBKeyRange.only(getFieldValue(filter, keyPaths[0]));
    }
    return new IDBKeyRange.only(keyPaths.map(function(keyPath) {
      getFieldValue(filter, keyPath);
    }));
  }
  function getFieldPaths(object) {
    var stopOnKeyRange = arguments[1] !== (void 0) ? arguments[1] : true;
    var fieldPaths = [];
    fieldPaths.containsKeyRange = false;
    generateFieldPaths(object, []);
    return fieldPaths;
    function generateFieldPaths(object, parts) {
      Object.keys(object).some(function(fieldName) {
        var value = object[fieldName];
        if (stopOnKeyRange && (value instanceof IDBKeyRange)) {
          fieldPaths = null;
          return true;
        }
        var isTerminalValue = !(value instanceof Object) || (value instanceof Date) || (value instanceof Array) || (value instanceof IDBKeyRange);
        var fieldPath = parts.slice();
        fieldPath.push(fieldName);
        if (isTerminalValue) {
          fieldPaths.push(fieldPath.join("."));
        } else {
          generateFieldPaths(value, fieldPath);
        }
      });
    }
  }
  function setFieldValue(object, fieldPath, value) {
    var parts = fieldPath.split(".");
    var done = [];
    var currentObject = object;
    while (parts.length) {
      var field = parts.shift();
      if (!parts.length) {
        if (currentObject.hasOwnProperty(field)) {
          throw new Error(("The " + fieldPath + " field seems to be already present "));
        }
        currentObject[field] = value;
        break;
      }
      if (!currentObject.hasOwnProperty(field)) {
        currentObject[field] = {};
      }
      if (!(currentObject[field] instanceof Object)) {
        throw new Error(("The " + fieldPath + " field is in a conflict with the ") + (done.join(".") + " field"));
      }
      currentObject = currentObject[field];
      done.push(field);
    }
  }
  function getFieldValue(object, fieldPath) {
    if (!fieldPath) {
      return object;
    }
    var currentObject = object;
    fieldPath.split(".").forEach(function(fieldName) {
      if (!currentObject.hasOwnProperty(fieldName)) {
        throw new Error(("The field path " + fieldPath + " does not exist in the ") + "provided object");
      }
      currentObject = currentObject[fieldName];
    });
    return currentObject;
  }
  return {
    get keyRangeToFieldRangeObject() {
      return keyRangeToFieldRangeObject;
    },
    get normalizeFilter() {
      return normalizeFilter;
    },
    get partiallyOptimizeFilter() {
      return partiallyOptimizeFilter;
    },
    get compileFieldRangeFilter() {
      return compileFieldRangeFilter;
    },
    get compileOrderingFieldPaths() {
      return compileOrderingFieldPaths;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/utils.js
