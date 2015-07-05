define(["./CursorDirection", "./utils"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var CursorDirection = $__0.default;
  var $__3 = $__2,
      normalizeFilter = $__3.normalizeFilter,
      compileOrderingFieldPaths = $__3.compileOrderingFieldPaths,
      partiallyOptimizeFilter = $__3.partiallyOptimizeFilter;
  var CURSOR_DIRECTIONS = Object.freeze([CursorDirection.NEXT, CursorDirection.PREVIOUS, "NEXT", "PREVIOUS", "PREV"]);
  function executeQuery(objectStore, filter, order, offset, limit, callback) {
    var $__18;
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
      (($__18 = preparedQuery, storage = $__18.storage, direction = $__18.direction, comparator = $__18.comparator, keyRange = $__18.keyRange, filter = $__18.filter, $__18));
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
      var $__7 = true;
      var $__8 = false;
      var $__9 = undefined;
      try {
        for (var $__5 = void 0,
            $__4 = (records)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
          var $__18 = $__5.value,
              record = $__18.record,
              primaryKey = $__18.primaryKey;
          {
            callback(record, primaryKey);
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
      var comparison$__24 = comparator(records[0].record, record);
      return (comparison$__24 > 0) ? 0 : 1;
    }
    var comparison = comparator(records[0].record, record);
    if (comparison > 0) {
      return 0;
    }
    var bottom = 1;
    var top = records.length - 1;
    while (bottom <= top) {
      var pivotIndex = Math.floor((bottom + top) / 2);
      var comparison$__25 = comparator(records[pivotIndex].record, record);
      if (comparison$__25 > 0) {
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
    var $__7 = true;
    var $__8 = false;
    var $__9 = undefined;
    try {
      for (var $__5 = void 0,
          $__4 = (thisStorage.indexNames)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
        var indexName = $__5.value;
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
    var simplifiedOrderFieldPaths = simplifyOrderingFieldPaths(order);
    if (canSortingBeOptimized) {
      prepareSortingOptimization(storages, simplifiedOrderFieldPaths);
    }
    prepareFilteringOptimization(storages, filter);
    return chooseStorageForQuery(storages, order, simplifiedOrderFieldPaths, canSortingBeOptimized, expectedSortingDirection);
  }
  function prepareSortingOptimization(storages, simplifiedOrderFieldPaths) {
    var $__19,
        $__20;
    var $__7 = true;
    var $__8 = false;
    var $__9 = undefined;
    try {
      for (var $__5 = void 0,
          $__4 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
        var $__18 = $__5.value,
            keyPath = ($__19 = $__18[$traceurRuntime.toProperty(Symbol.iterator)](), ($__20 = $__19.next()).done ? void 0 : $__20.value),
            storageAndScore = ($__20 = $__19.next()).done ? void 0 : $__20.value;
        {
          var keyPathSlice = keyPath.slice(0, simplifiedOrderFieldPaths.length);
          if (indexedDB.cmp(keyPathSlice, simplifiedOrderFieldPaths) === 0) {
            storageAndScore.score += 4;
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
  }
  function prepareFilteringOptimization(storages, filter) {
    var $__19,
        $__20,
        $__22,
        $__23;
    if (filter instanceof Function) {
      var $__7 = true;
      var $__8 = false;
      var $__9 = undefined;
      try {
        for (var $__5 = void 0,
            $__4 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
          var $__18 = $__5.value,
              keyPath = ($__19 = $__18[$traceurRuntime.toProperty(Symbol.iterator)](), ($__20 = $__19.next()).done ? void 0 : $__20.value),
              storageAndScore = ($__20 = $__19.next()).done ? void 0 : $__20.value;
          {
            storageAndScore.filter = filter;
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
      return;
    }
    var $__14 = true;
    var $__15 = false;
    var $__16 = undefined;
    try {
      for (var $__12 = void 0,
          $__11 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__14 = ($__12 = $__11.next()).done); $__14 = true) {
        var $__21 = $__12.value,
            keyPath$__26 = ($__22 = $__21[$traceurRuntime.toProperty(Symbol.iterator)](), ($__23 = $__22.next()).done ? void 0 : $__23.value),
            storageAndScore$__27 = ($__23 = $__22.next()).done ? void 0 : $__23.value;
        {
          var normalizedFilter = normalizeFilter(filter, keyPath$__26);
          if (normalizedFilter instanceof Function) {
            var isOptimizableFilter = (filter instanceof Object) && !(filter instanceof Date) && !(filter instanceof Array) && !(filter instanceof IDBKeyRange);
            if (isOptimizableFilter) {
              var partialOptimization = partiallyOptimizeFilter(filter, keyPath$__26);
              storageAndScore$__27.keyRange = partialOptimization.keyRange;
              storageAndScore$__27.filter = partialOptimization.filter;
              if (partialOptimization.score) {
                storageAndScore$__27.score += 1 + partialOptimization.score;
              }
            } else {
              storageAndScore$__27.filter = normalizedFilter;
            }
          } else {
            storageAndScore$__27.keyRange = normalizedFilter;
            storageAndScore$__27.score += 2;
          }
        }
      }
    } catch ($__17) {
      $__15 = true;
      $__16 = $__17;
    } finally {
      try {
        if (!$__14 && $__11.return != null) {
          $__11.return();
        }
      } finally {
        if ($__15) {
          throw $__16;
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
    var optimizeSorting = canSortingBeOptimized && (indexedDB.cmp(storageKeyPathSlice, simplifiedOrderFieldPaths) === 0);
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
    var $__7 = true;
    var $__8 = false;
    var $__9 = undefined;
    try {
      for (var $__5 = void 0,
          $__4 = (order)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
        var orderingFieldPath = $__5.value;
        {
          if ((orderingFieldPath.charAt(0) === "!") !== expectedSortingDirection) {
            return false;
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
