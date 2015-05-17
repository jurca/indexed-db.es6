define(["./KeyRange"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var KeyRange = $__0.default;
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
    keyPath.forEach((function(fieldPath, index) {
      var fieldLowerBound = lowerBound ? lowerBound[index] : undefined;
      var fieldUpperBound = upperBound ? upperBound[index] : undefined;
      var fieldRange = KeyRange.bound(fieldLowerBound, fieldUpperBound, lowerBoundOpen, upperBoundOpen);
      setFieldValue(fieldRangeObject, fieldPath, fieldRange);
    }));
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
  function compileFieldRangeFilter(filter) {
    var fieldPaths = getFieldPaths(filter, false);
    var fieldFilters = fieldPaths.map((function(fieldPath) {
      var fieldRange = getFieldValue(filter, fieldPath);
      if (!(fieldRange instanceof IDBKeyRange)) {
        fieldRange = KeyRange.only(fieldRange);
      }
      return (function(record) {
        var fieldValue;
        try {
          fieldValue = getFieldValue(record, fieldPath);
        } catch (error) {
          return false;
        }
        if (fieldRange.lower !== undefined) {
          var lowerComparison;
          lowerComparison = indexedDB.cmp(fieldRange.lower, fieldValue);
          var failedTest = (lowerComparison > 0) || (fieldRange.lowerOpen && (lowerComparison === 0));
          if (failedTest) {
            return false;
          }
        }
        if (fieldRange.upper !== undefined) {
          var upperComparison;
          upperComparison = indexedDB.cmp(fieldRange.upper, fieldValue);
          var failedTest$__9 = (upperComparison < 0) || (fieldRange.upperOpen && (upperComparison === 0));
          if (failedTest$__9) {
            return false;
          }
        }
        return true;
      });
    }));
    return (function(record) {
      if (!(record instanceof Object)) {
        return false;
      }
      return fieldFilters.every((function(fieldFilter) {
        return fieldFilter(record);
      }));
    });
  }
  function compileOrderingFieldPaths(orderingFieldPaths) {
    if (typeof orderingFieldPaths === "string") {
      orderingFieldPaths = [orderingFieldPaths];
    }
    var inverted = [];
    var getters = [];
    var $__5 = true;
    var $__6 = false;
    var $__7 = undefined;
    try {
      for (var $__3 = void 0,
          $__2 = (orderingFieldPaths)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
        var fieldPath = $__3.value;
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
    } catch ($__8) {
      $__6 = true;
      $__7 = $__8;
    } finally {
      try {
        if (!$__5 && $__2.return != null) {
          $__2.return();
        }
      } finally {
        if ($__6) {
          throw $__7;
        }
      }
    }
    var gettersCount = getters.length;
    return (function(record1, record2) {
      for (var i = 0; i < gettersCount; i++) {
        var getter = getters[i];
        var value1 = getter(record1);
        var value2 = getter(record2);
        var comparison;
        if (inverted[i]) {
          comparison = indexedDB.cmp(value2, value1);
        } else {
          comparison = indexedDB.cmp(value1, value2);
        }
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    });
  }
  function compileFieldGetter(fieldPath) {
    var fields = fieldPath.split(".");
    return (function(record) {
      var value = record;
      var $__5 = true;
      var $__6 = false;
      var $__7 = undefined;
      try {
        for (var $__3 = void 0,
            $__2 = (fields)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
          var field = $__3.value;
          {
            if (!(value instanceof Object) || !value.hasOwnProperty(field)) {
              return undefined;
            }
            value = value[field];
          }
        }
      } catch ($__8) {
        $__6 = true;
        $__7 = $__8;
      } finally {
        try {
          if (!$__5 && $__2.return != null) {
            $__2.return();
          }
        } finally {
          if ($__6) {
            throw $__7;
          }
        }
      }
      return value;
    });
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
    var isKeyFilter = (fieldPaths.length === keyPaths.length) && fieldPaths.every((function(path) {
      return keyPaths.indexOf(path) > -1;
    }));
    if (!isKeyFilter) {
      return null;
    }
    if (keyPaths.length === 1) {
      return IDBKeyRange.only(getFieldValue(filter, keyPaths[0]));
    }
    return new IDBKeyRange.only(keyPaths.map((function(keyPath) {
      getFieldValue(filter, keyPath);
    })));
  }
  function getFieldPaths(object) {
    var stopOnKeyRange = arguments[1] !== (void 0) ? arguments[1] : true;
    var fieldPaths = [];
    fieldPaths.containsKeyRange = false;
    generateFieldPaths(object, []);
    return fieldPaths;
    function generateFieldPaths(object, parts) {
      Object.keys(object).some((function(fieldName) {
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
      }));
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
    fieldPath.split(".").forEach((function(fieldName) {
      if (!currentObject.hasOwnProperty(fieldName)) {
        throw new Error(("The field path " + fieldPath + " does not exist in the ") + "provided object");
      }
      currentObject = currentObject[fieldName];
    }));
    return currentObject;
  }
  return {
    get keyRangeToFieldRangeObject() {
      return keyRangeToFieldRangeObject;
    },
    get normalizeFilter() {
      return normalizeFilter;
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
