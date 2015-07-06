define(["../NativeDBAccessor", "./CursorDirection", "./utils"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var idbProvider = $__0.idbProvider;
  var CursorDirection = $__2.default;
  var $__5 = $__4,
      normalizeFilter = $__5.normalizeFilter,
      compileOrderingFieldPaths = $__5.compileOrderingFieldPaths,
      partiallyOptimizeFilter = $__5.partiallyOptimizeFilter;
  var CURSOR_DIRECTIONS = Object.freeze([CursorDirection.NEXT, CursorDirection.PREVIOUS, "NEXT", "PREVIOUS", "PREV"]);
  function executeQuery(objectStore, filter, order, offset, limit, callback) {
    var $__20;
    if ((offset < 0) || (Math.floor(offset) !== offset)) {
      throw new Error("The offset must be a non-negative integer, " + (offset + " provided"));
    }
    if ((limit !== null) && ((limit <= 0) || (Math.floor(limit) !== limit))) {
      throw new Error("The limit must be a positive integer or null, " + (limit + " provided"));
    }
    var keyRange = undefined;
    var direction;
    var comparator = null;
    var storage = objectStore;
    order = prepareOrderingSpecificationForQuery(order, objectStore.keyPath);
    if (order instanceof Function) {
      direction = CursorDirection.NEXT;
      comparator = order;
      filter = normalizeFilter(filter, storage.keyPath);
      if (!(filter instanceof Function)) {
        keyRange = filter;
        filter = null;
      }
    } else {
      var preparedQuery = prepareQuery(storage, filter, order);
      ;
      (($__20 = preparedQuery, storage = $__20.storage, direction = $__20.direction, comparator = $__20.comparator, keyRange = $__20.keyRange, filter = $__20.filter, $__20));
    }
    return runQuery(storage.createCursorFactory(keyRange, direction), filter, comparator, offset, limit, callback);
  }
  var $__default = executeQuery;
  function runQuery(cursorFactory, filter, comparator, offset, limit, callback) {
    var records = [];
    var recordIndex = -1;
    return cursorFactory(function(cursor) {
      if (!filter && offset && ((recordIndex + 1) < offset)) {
        recordIndex = offset - 1;
        cursor.advance(offset);
        return;
      }
      var primaryKey = cursor.primaryKey;
      if (filter && !filter(cursor.record, primaryKey)) {
        cursor.continue();
        return;
      }
      if (comparator) {
        insertSorted(records, cursor.record, primaryKey, comparator);
        if (offset || limit) {
          if (records.length > (offset + limit)) {
            records.pop();
          }
        }
        cursor.continue();
        return;
      }
      recordIndex++;
      if (recordIndex < offset) {
        cursor.continue();
        return;
      }
      callback(cursor.record, primaryKey);
      if (!limit || ((recordIndex + 1) < (offset + limit))) {
        cursor.continue();
      }
    }).then(function() {
      if (!comparator) {
        return;
      }
      records = records.slice(offset);
      var $__9 = true;
      var $__10 = false;
      var $__11 = undefined;
      try {
        for (var $__7 = void 0,
            $__6 = (records)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__9 = ($__7 = $__6.next()).done); $__9 = true) {
          var $__20 = $__7.value,
              record = $__20.record,
              primaryKey = $__20.primaryKey;
          {
            callback(record, primaryKey);
          }
        }
      } catch ($__12) {
        $__10 = true;
        $__11 = $__12;
      } finally {
        try {
          if (!$__9 && $__6.return != null) {
            $__6.return();
          }
        } finally {
          if ($__10) {
            throw $__11;
          }
        }
      }
    });
  }
  function insertSorted(records, record, primaryKey, comparator) {
    var index = findInsertIndex(records, record, comparator);
    records.splice(index, 0, {
      record: record,
      primaryKey: primaryKey
    });
  }
  function findInsertIndex(records, record, comparator) {
    if (!records.length) {
      return 0;
    }
    if (records.length === 1) {
      var comparison$__26 = comparator(records[0].record, record);
      return (comparison$__26 > 0) ? 0 : 1;
    }
    var comparison = comparator(records[0].record, record);
    if (comparison > 0) {
      return 0;
    }
    var bottom = 1;
    var top = records.length - 1;
    while (bottom <= top) {
      var pivotIndex = Math.floor((bottom + top) / 2);
      var comparison$__27 = comparator(records[pivotIndex].record, record);
      if (comparison$__27 > 0) {
        var previousElement = records[pivotIndex - 1].record;
        if (comparator(previousElement, record) <= 0) {
          return pivotIndex;
        }
        top = pivotIndex - 1;
      } else {
        bottom = pivotIndex + 1;
      }
    }
    return records.length;
  }
  function prepareQuery(thisStorage, filter, order) {
    order = normalizeKeyPath(order);
    var expectedSortingDirection = order[0].charAt(0) === "!";
    var canSortingBeOptimized;
    canSortingBeOptimized = canOptimizeSorting(expectedSortingDirection, order);
    var storages = new Map();
    storages.set(normalizeKeyPath(thisStorage.keyPath), {
      storage: thisStorage,
      score: 1
    });
    var $__9 = true;
    var $__10 = false;
    var $__11 = undefined;
    try {
      for (var $__7 = void 0,
          $__6 = (thisStorage.indexNames)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__9 = ($__7 = $__6.next()).done); $__9 = true) {
        var indexName = $__7.value;
        {
          var index = thisStorage.getIndex(indexName);
          if (!index.multiEntry) {
            storages.set(normalizeKeyPath(index.keyPath), {
              storage: index,
              score: 0
            });
          }
        }
      }
    } catch ($__12) {
      $__10 = true;
      $__11 = $__12;
    } finally {
      try {
        if (!$__9 && $__6.return != null) {
          $__6.return();
        }
      } finally {
        if ($__10) {
          throw $__11;
        }
      }
    }
    var simplifiedOrderFieldPaths = simplifyOrderingFieldPaths(order);
    if (canSortingBeOptimized) {
      prepareSortingOptimization(storages, simplifiedOrderFieldPaths);
    }
    prepareFilteringOptimization(storages, filter);
    return chooseStorageForQuery(storages, order, simplifiedOrderFieldPaths, canSortingBeOptimized, expectedSortingDirection);
  }
  function prepareSortingOptimization(storages, simplifiedOrderFieldPaths) {
    var $__21,
        $__22;
    var idb = idbProvider();
    var $__9 = true;
    var $__10 = false;
    var $__11 = undefined;
    try {
      for (var $__7 = void 0,
          $__6 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__9 = ($__7 = $__6.next()).done); $__9 = true) {
        var $__20 = $__7.value,
            keyPath = ($__21 = $__20[$traceurRuntime.toProperty(Symbol.iterator)](), ($__22 = $__21.next()).done ? void 0 : $__22.value),
            storageAndScore = ($__22 = $__21.next()).done ? void 0 : $__22.value;
        {
          var keyPathSlice = keyPath.slice(0, simplifiedOrderFieldPaths.length);
          if (idb.cmp(keyPathSlice, simplifiedOrderFieldPaths) === 0) {
            storageAndScore.score += 4;
          }
        }
      }
    } catch ($__12) {
      $__10 = true;
      $__11 = $__12;
    } finally {
      try {
        if (!$__9 && $__6.return != null) {
          $__6.return();
        }
      } finally {
        if ($__10) {
          throw $__11;
        }
      }
    }
  }
  function prepareFilteringOptimization(storages, filter) {
    var $__21,
        $__22,
        $__24,
        $__25;
    if (filter instanceof Function) {
      var $__9 = true;
      var $__10 = false;
      var $__11 = undefined;
      try {
        for (var $__7 = void 0,
            $__6 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__9 = ($__7 = $__6.next()).done); $__9 = true) {
          var $__20 = $__7.value,
              keyPath = ($__21 = $__20[$traceurRuntime.toProperty(Symbol.iterator)](), ($__22 = $__21.next()).done ? void 0 : $__22.value),
              storageAndScore = ($__22 = $__21.next()).done ? void 0 : $__22.value;
          {
            storageAndScore.filter = filter;
          }
        }
      } catch ($__12) {
        $__10 = true;
        $__11 = $__12;
      } finally {
        try {
          if (!$__9 && $__6.return != null) {
            $__6.return();
          }
        } finally {
          if ($__10) {
            throw $__11;
          }
        }
      }
      return;
    }
    var $__16 = true;
    var $__17 = false;
    var $__18 = undefined;
    try {
      for (var $__14 = void 0,
          $__13 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__16 = ($__14 = $__13.next()).done); $__16 = true) {
        var $__23 = $__14.value,
            keyPath$__28 = ($__24 = $__23[$traceurRuntime.toProperty(Symbol.iterator)](), ($__25 = $__24.next()).done ? void 0 : $__25.value),
            storageAndScore$__29 = ($__25 = $__24.next()).done ? void 0 : $__25.value;
        {
          var normalizedFilter = normalizeFilter(filter, keyPath$__28);
          if (normalizedFilter instanceof Function) {
            var isOptimizableFilter = (filter instanceof Object) && !(filter instanceof Date) && !(filter instanceof Array) && !(filter instanceof IDBKeyRange);
            if (isOptimizableFilter) {
              var partialOptimization = partiallyOptimizeFilter(filter, keyPath$__28);
              storageAndScore$__29.keyRange = partialOptimization.keyRange;
              storageAndScore$__29.filter = partialOptimization.filter;
              if (partialOptimization.score) {
                storageAndScore$__29.score += 1 + partialOptimization.score;
              }
            } else {
              storageAndScore$__29.filter = normalizedFilter;
            }
          } else {
            storageAndScore$__29.keyRange = normalizedFilter;
            storageAndScore$__29.score += 2;
          }
        }
      }
    } catch ($__19) {
      $__17 = true;
      $__18 = $__19;
    } finally {
      try {
        if (!$__16 && $__13.return != null) {
          $__13.return();
        }
      } finally {
        if ($__17) {
          throw $__18;
        }
      }
    }
  }
  function chooseStorageForQuery(storages, order, simplifiedOrderFieldPaths, canSortingBeOptimized, expectedSortingDirection) {
    var sortedStorages = Array.from(storages.values());
    sortedStorages.sort(function(storage1, storage2) {
      return storage2.score - storage1.score;
    });
    var chosenStorageDetails = sortedStorages[0];
    var chosenStorage = chosenStorageDetails.storage;
    var chosenStorageKeyPath = normalizeKeyPath(chosenStorage.keyPath);
    var storageKeyPathSlice = chosenStorageKeyPath.slice(0, simplifiedOrderFieldPaths.length);
    var optimizeSorting = canSortingBeOptimized && (idbProvider().cmp(storageKeyPathSlice, simplifiedOrderFieldPaths) === 0);
    return {
      storage: chosenStorage,
      direction: optimizeSorting ? (CursorDirection[expectedSortingDirection ? "PREVIOUS" : "NEXT"]) : CursorDirection.NEXT,
      comparator: optimizeSorting ? null : compileOrderingFieldPaths(order),
      keyRange: chosenStorageDetails.keyRange,
      filter: chosenStorageDetails.filter
    };
  }
  function simplifyOrderingFieldPaths(order) {
    return order.map(function(fieldPath) {
      return fieldPath.replace(/^!/, "");
    });
  }
  function canOptimizeSorting(expectedSortingDirection, order) {
    var $__9 = true;
    var $__10 = false;
    var $__11 = undefined;
    try {
      for (var $__7 = void 0,
          $__6 = (order)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__9 = ($__7 = $__6.next()).done); $__9 = true) {
        var orderingFieldPath = $__7.value;
        {
          if ((orderingFieldPath.charAt(0) === "!") !== expectedSortingDirection) {
            return false;
          }
        }
      }
    } catch ($__12) {
      $__10 = true;
      $__11 = $__12;
    } finally {
      try {
        if (!$__9 && $__6.return != null) {
          $__6.return();
        }
      } finally {
        if ($__10) {
          throw $__11;
        }
      }
    }
    return true;
  }
  function prepareOrderingSpecificationForQuery(order, keyPath) {
    if (order === null) {
      order = CursorDirection.NEXT;
    }
    var isCursorDirection = ((typeof order === "string") && (CURSOR_DIRECTIONS.indexOf(order.toUpperCase()) > -1)) || (CURSOR_DIRECTIONS.indexOf(order) > -1);
    if (isCursorDirection && (typeof order === "string")) {
      order = CursorDirection[order.toUpperCase()] || CursorDirection.PREVIOUS;
    }
    if (order instanceof CursorDirection) {
      keyPath = normalizeKeyPath(keyPath);
      if (order === CursorDirection.NEXT) {
        return keyPath;
      } else {
        return keyPath.map(function(fieldPath) {
          return ("!" + fieldPath);
        });
      }
    }
    return order;
  }
  function normalizeKeyPath(keyPath) {
    if (typeof keyPath === "string") {
      return [keyPath];
    }
    return keyPath;
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/query-engine.js
