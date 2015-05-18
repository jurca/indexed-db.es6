define(["./AbstractReadOnlyStorage", "./CursorDirection", "./ReadOnlyIndex", "./utils"], function($__0,$__2,$__4,$__6) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var AbstractReadOnlyStorage = $__0.default;
  var CursorDirection = $__2.default;
  var ReadOnlyIndex = $__4.default;
  var $__7 = $__6,
      normalizeFilter = $__7.normalizeFilter,
      compileOrderingFieldPaths = $__7.compileOrderingFieldPaths;
  var CURSOR_DIRECTIONS = Object.freeze([CursorDirection.NEXT, CursorDirection.PREVIOUS, "NEXT", "PREVIOUS", "PREV"]);
  var FIELDS = Object.freeze({
    objectStore: Symbol("objectStore"),
    indexes: Symbol("indexes"),
    transactionFactory: Symbol("transactionFactory"),
    cursorConstructor: Symbol("cursorConstructor")
  });
  var ReadOnlyObjectStore = (function($__super) {
    function ReadOnlyObjectStore(storage, cursorConstructor, transactionFactory) {
      var storageFactory = (function() {
        var transaction = transactionFactory();
        return transaction.getObjectStore(storage.name);
      });
      $traceurRuntime.superConstructor(ReadOnlyObjectStore).call(this, storage, cursorConstructor, storageFactory);
      this.autoIncrement = storage.autoIncrement;
      this.indexNames = Object.freeze(Array.from(storage.indexNames));
      this[FIELDS.objectStore] = storage;
      this[FIELDS.indexes] = new Map();
      this[FIELDS.transactionFactory] = transactionFactory;
      this[FIELDS.cursorConstructor] = cursorConstructor;
      if (this.constructor === ReadOnlyObjectStore) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyObjectStore, {
      getIndex: function(indexName) {
        if (this[FIELDS.indexes].has(indexName)) {
          return this[FIELDS.indexes].get(indexName);
        }
        var nativeIndex = this[FIELDS.objectStore].index(indexName);
        var index = new ReadOnlyIndex(nativeIndex, this[FIELDS.cursorConstructor], this[FIELDS.transactionFactory]);
        this[FIELDS.indexes].set(indexName, index);
        return index;
      },
      query: function() {
        var $__30;
        var filter = arguments[0] !== (void 0) ? arguments[0] : null;
        var order = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var offset = arguments[2] !== (void 0) ? arguments[2] : 0;
        var limit = arguments[3] !== (void 0) ? arguments[3] : null;
        if ((offset < 0) || (Math.floor(offset) !== offset)) {
          throw new Error("The offset must be a non-negative integer, " + (offset + " provided"));
        }
        if ((limit !== null) && ((limit <= 0) || (Math.floor(limit) !== limit))) {
          throw new Error("The limit must be a positive integer or null, " + (limit + " provided"));
        }
        var direction;
        var comparator = null;
        var storage = this;
        if (CURSOR_DIRECTIONS.indexOf(order) > -1) {
          direction = order;
        } else if (order === null) {
          direction = CursorDirection.NEXT;
        } else if (order instanceof Function) {
          direction = CursorDirection.NEXT;
          comparator = order;
        } else {
          (($__30 = prepareQuery(this, filter, order), storage = $__30.storage, direction = $__30.direction, comparator = $__30.comparator, $__30));
        }
        filter = normalizeFilter(filter, storage.keyPath);
        var keyRange;
        if (filter instanceof Function) {
          keyRange = undefined;
        } else {
          keyRange = filter;
          filter = null;
        }
        return runQuery(storage.createCursorFactory(keyRange, direction), storage.multiEntry, filter, comparator, offset, limit);
      }
    }, {}, $__super);
  }(AbstractReadOnlyStorage));
  var $__default = ReadOnlyObjectStore;
  function runQuery(cursorFactory, containsRepeatingRecords, filter, comparator, offset, limit) {
    var records = [];
    var recordIndex = -1;
    return cursorFactory((function(cursor) {
      if (!filter && offset && ((recordIndex + 1) < offset)) {
        recordIndex = offset - 1;
        cursor.advance(offset);
        return ;
      }
      var primaryKey = cursor.primaryKey;
      if (filter && !filter(cursor.record, primaryKey, cursor.key)) {
        cursor.continue();
        return ;
      }
      recordIndex++;
      if (recordIndex < offset) {
        cursor.continue();
        return ;
      }
      if (containsRepeatingRecords && isRecordPresent(records, primaryKey)) {
        cursor.continue();
        return ;
      }
      if (comparator) {
        insertSorted(records, cursor.record, primaryKey, comparator);
        if (limit && (records.length > limit)) {
          records.pop();
        }
      } else {
        records.push({
          record: cursor.record,
          primaryKey: primaryKey
        });
      }
      if (!comparator && limit && (records.length >= limit)) {
        return ;
      }
      cursor.continue();
    })).then((function() {
      return records.map((function(recordAndKey) {
        return recordAndKey.record;
      }));
    }));
  }
  function isRecordPresent(records, recordPrimaryKey) {
    var $__12 = true;
    var $__13 = false;
    var $__14 = undefined;
    try {
      for (var $__10 = void 0,
          $__9 = (records)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__12 = ($__10 = $__9.next()).done); $__12 = true) {
        var $__30 = $__10.value,
            record = $__30.record,
            primaryKey = $__30.primaryKey;
        {
          if (indexedDB.cmp(primaryKey, recordPrimaryKey) === 0) {
            return true;
          }
        }
      }
    } catch ($__15) {
      $__13 = true;
      $__14 = $__15;
    } finally {
      try {
        if (!$__12 && $__9.return != null) {
          $__9.return();
        }
      } finally {
        if ($__13) {
          throw $__14;
        }
      }
    }
    return false;
  }
  function prepareQuery(thisStorage, filter, order) {
    var $__31,
        $__32,
        $__34,
        $__35;
    order = normalizeKeyPath(order);
    var expectedSortingDirection = order[0].charAt(0) === "!";
    var canOptimizeOrder = canOptimizeSorting(expectedSortingDirection, order);
    var storages = new Map();
    storages.put(normalizeKeyPath(thisStorage.keyPath), {
      storage: thisStorage,
      score: 1
    });
    var $__12 = true;
    var $__13 = false;
    var $__14 = undefined;
    try {
      for (var $__10 = void 0,
          $__9 = (thisStorage.indexNames)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__12 = ($__10 = $__9.next()).done); $__12 = true) {
        var indexName = $__10.value;
        {
          var index = thisStorage.getIndex(indexName);
          storages.push(normalizeKeyPath(index.keyPath), {
            storage: index,
            score: 0
          });
        }
      }
    } catch ($__15) {
      $__13 = true;
      $__14 = $__15;
    } finally {
      try {
        if (!$__12 && $__9.return != null) {
          $__9.return();
        }
      } finally {
        if ($__13) {
          throw $__14;
        }
      }
    }
    var simplifiedOrderFieldPaths = simplifyOrderingFieldPaths(order);
    if (canOptimizeOrder) {
      var $__19 = true;
      var $__20 = false;
      var $__21 = undefined;
      try {
        for (var $__17 = void 0,
            $__16 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__19 = ($__17 = $__16.next()).done); $__19 = true) {
          var $__30 = $__17.value,
              keyPath = ($__31 = $__30[$traceurRuntime.toProperty(Symbol.iterator)](), ($__32 = $__31.next()).done ? void 0 : $__32.value),
              storageAndScore = ($__32 = $__31.next()).done ? void 0 : $__32.value;
          {
            if (indexedDB.cmp(keyPath, simplifiedOrderFieldPaths) === 0) {
              storageAndScore.score += 4;
            }
          }
        }
      } catch ($__22) {
        $__20 = true;
        $__21 = $__22;
      } finally {
        try {
          if (!$__19 && $__16.return != null) {
            $__16.return();
          }
        } finally {
          if ($__20) {
            throw $__21;
          }
        }
      }
    }
    if (!(filter instanceof Function)) {
      var $__26 = true;
      var $__27 = false;
      var $__28 = undefined;
      try {
        for (var $__24 = void 0,
            $__23 = (storages)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__26 = ($__24 = $__23.next()).done); $__26 = true) {
          var $__33 = $__24.value,
              keyPath$__36 = ($__34 = $__33[$traceurRuntime.toProperty(Symbol.iterator)](), ($__35 = $__34.next()).done ? void 0 : $__35.value),
              storageAndScore$__37 = ($__35 = $__34.next()).done ? void 0 : $__35.value;
          {
            var normalizedFilter = normalizeFilter(filter, keyPath$__36);
            if (!(normalizedFilter instanceof Function)) {
              storageAndScore$__37.score += 2;
            }
          }
        }
      } catch ($__29) {
        $__27 = true;
        $__28 = $__29;
      } finally {
        try {
          if (!$__26 && $__23.return != null) {
            $__23.return();
          }
        } finally {
          if ($__27) {
            throw $__28;
          }
        }
      }
    }
    var sortedStorages = Array.from(storages.values());
    sortedStorages.sort((function(storage1, storage2) {
      storage2.score - storage1.score;
    }));
    var chosenStorage = sortedStorages[0];
    var optimizeSorting = canOptimizeOrder && (indexedDB.cmp(chosenStorage.keyPath, simplifiedOrderFieldPaths) === 0);
    return {
      storage: chosenStorage,
      direction: optimizeSorting ? (CursorDirection[expectedSortingDirection ? "PREVIOUS" : "NEXT"]) : CursorDirection.NEXT,
      comparator: optimizeSorting ? null : compileOrderingFieldPaths(order)
    };
  }
  function simplifyOrderingFieldPaths(order) {
    return order.map((function(fieldPath) {
      return fieldPath.replace(/^!/, "");
    }));
  }
  function canOptimizeSorting(expectedSortingDirection, order) {
    var $__12 = true;
    var $__13 = false;
    var $__14 = undefined;
    try {
      for (var $__10 = void 0,
          $__9 = (order)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__12 = ($__10 = $__9.next()).done); $__12 = true) {
        var orderingFieldPath = $__10.value;
        {
          if ((orderingFieldPath.charAt(0) === "!") !== expectedSortingDirection) {
            return false;
          }
        }
      }
    } catch ($__15) {
      $__13 = true;
      $__14 = $__15;
    } finally {
      try {
        if (!$__12 && $__9.return != null) {
          $__9.return();
        }
      } finally {
        if ($__13) {
          throw $__14;
        }
      }
    }
    return true;
  }
  function normalizeKeyPath(keyPath) {
    if (typeof keyPath === "string") {
      return [keyPath];
    }
    return keyPath;
  }
  function insertSorted(records, record, primaryKey, comparator) {
    for (var i = 0; i < records.length; i++) {
      var comparison = comparator(records[i], record);
      if (comparison > 0) {
        records.splice(i, 0, {
          record: record,
          primaryKey: primaryKey
        });
        return ;
      }
    }
    records.push(record);
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/ReadOnlyObjectStore.js
