define(["../PromiseSync", "./AbstractBaseStorage", "./CursorDirection", "./KeyRange", "./RecordList", "./utils"], function($__0,$__2,$__4,$__6,$__8,$__10) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  var PromiseSync = $__0.default;
  var AbstractBaseStorage = $__2.default;
  var CursorDirection = $__4.default;
  var KeyRange = $__6.default;
  var RecordList = $__8.default;
  var $__11 = $__10,
      compileFieldRangeFilter = $__11.compileFieldRangeFilter,
      normalizeFilter = $__11.normalizeFilter,
      keyRangeToFieldRangeObject = $__11.keyRangeToFieldRangeObject;
  var FIELDS = Object.freeze({
    storage: Symbol("storage"),
    unique: Symbol("unique"),
    storageFactory: Symbol("storageFactory")
  });
  var AbstractReadOnlyStorage = (function($__super) {
    function AbstractReadOnlyStorage(storage, cursorConstructor, storageFactory) {
      $traceurRuntime.superConstructor(AbstractReadOnlyStorage).call(this, storage, cursorConstructor);
      if (this.constructor === AbstractReadOnlyStorage) {
        throw new Error("The AbstractReadOnlyStorage class is abstract and " + "must be overridden");
      }
      this[FIELDS.storage] = storage;
      this[FIELDS.unique] = storage instanceof IDBObjectStore || storage.unique;
      this[FIELDS.storageFactory] = storageFactory;
    }
    return ($traceurRuntime.createClass)(AbstractReadOnlyStorage, {
      exists: function(filter) {
        return this.count(filter).then((function(count) {
          return count > 0;
        }));
      },
      count: function() {
        var filter = arguments[0];
        filter = normalizeFilter(filter, this.keyPath);
        if (filter instanceof Function) {
          return this.forEach(filter, CursorDirection.NEXT, (function() {}));
        }
        var request = this[FIELDS.storage].count(filter);
        return PromiseSync.resolve(request);
      },
      forEach: function(filter, direction, callback) {
        var $__12 = this;
        filter = normalizeFilter(filter, this.keyPath);
        var keyRange;
        if (filter instanceof Function) {
          keyRange = undefined;
        } else {
          keyRange = filter;
          filter = null;
        }
        var count = 0;
        return new PromiseSync((function(resolve, reject) {
          $__12.openCursor(keyRange, direction).then(iterate).catch(reject);
          function iterate(cursor) {
            if (cursor.done) {
              resolve(count);
              return ;
            }
            if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
              callback(cursor.record, cursor.primaryKey, cursor.key);
              count++;
            }
            cursor.advance().then(iterate).catch(reject);
          }
        }));
      },
      getAll: function() {
        var filter = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var $__12 = this;
        return new PromiseSync((function(resolve, reject) {
          var records = [];
          $__12.forEach(filter, direction, (function(record) {
            records.push(record);
          })).then((function() {
            return resolve(records);
          })).catch(reject);
        }));
      },
      list: function() {
        var filter = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var pageSize = arguments[2] !== (void 0) ? arguments[2] : 50;
        if (!/^[1-9]\d*$/.test(("" + pageSize))) {
          throw new Error("The page size must be a positive integer, " + (pageSize + " provided"));
        }
        filter = normalizeFilter(filter, this.keyPath);
        var keyRange = undefined;
        if (filter instanceof IDBKeyRange) {
          keyRange = filter;
          if (this.keyPath) {
            filter = keyRangeToFieldRangeObject(filter, this.keyPath);
            filter = compileFieldRangeFilter(filter);
          } else {
            var primaryKeyFilter = compileFieldRangeFilter({primaryKey: filter});
            filter = (function(record, primaryKey) {
              return primaryKeyFilter({primaryKey: primaryKey});
            });
          }
        }
        var unique = this[FIELDS.unique];
        var storageFactory = this[FIELDS.storageFactory];
        return list(this, keyRange, filter, direction, unique, pageSize, storageFactory);
      }
    }, {}, $__super);
  }(AbstractBaseStorage));
  var $__default = AbstractReadOnlyStorage;
  function list(storage, keyRange, filter, direction, unique, pageSize, storageFactory) {
    return new Promise((function(resolve, reject) {
      var items = [];
      storage.openCursor(keyRange, direction).then(iterate).catch(reject);
      function iterate(cursor) {
        if (cursor.done) {
          finalize(false, null, null);
          return ;
        }
        if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
          if (items.length === pageSize) {
            finalize(true, cursor.key, cursor.primaryKey);
          } else {
            items.push(cursor.record);
          }
        }
        cursor.advance().then(iterate).catch(reject);
      }
      function finalize(hasNextPage, nextKey, nextPrimaryKey) {
        resolve(new RecordList(items, storageFactory, nextKey, nextPrimaryKey, direction, unique, filter, pageSize, hasNextPage));
      }
    }));
  }
  function normalizeCompoundObjectKey(keyPaths, key) {
    var normalizedKey = [];
    keyPaths.forEach((function(keyPath) {
      var keyValue = key;
      keyPath.split(".").forEach((function(fieldName) {
        if (!keyValue.hasOwnProperty(fieldName)) {
          throw new Error(("The " + keyPath + " key path is not defined in the ") + "provided compound key");
        }
        keyValue = keyValue[fieldName];
      }));
      normalizedKey.push(keyValue);
    }));
    return normalizedKey;
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/AbstractReadOnlyStorage.js
