define(["../PromiseSync", "./ReadOnlyObjectStore", "./Cursor", "./CursorDirection", "./Index", "./utils"], function($__0,$__2,$__4,$__6,$__8,$__10) {
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
  var ReadOnlyObjectStore = $__2.default;
  var Cursor = $__4.default;
  var CursorDirection = $__6.default;
  var Index = $__8.default;
  var normalizeFilter = $__10.normalizeFilter;
  var FIELDS = Object.freeze({
    objectStore: Symbol("objectStore"),
    indexes: Symbol("indexes"),
    transactionFactory: Symbol("transactionFactory")
  });
  var ObjectStore = function($__super) {
    function ObjectStore(storage, transactionFactory) {
      $traceurRuntime.superConstructor(ObjectStore).call(this, storage, Cursor, transactionFactory);
      this[FIELDS.objectStore] = storage;
      this[FIELDS.indexes] = new Map();
      this[FIELDS.transactionFactory] = transactionFactory;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(ObjectStore, {
      add: function(record) {
        var key = arguments[1];
        var request = this[FIELDS.objectStore].add(record, key);
        return PromiseSync.resolve(request);
      },
      put: function(record) {
        var key = arguments[1];
        var request = this[FIELDS.objectStore].put(record, key);
        return PromiseSync.resolve(request);
      },
      delete: function(filter) {
        var $__12 = this;
        filter = normalizeFilter(filter, this.keyPath);
        if (filter instanceof IDBKeyRange) {
          var request = this[FIELDS.objectStore].delete(filter);
          return PromiseSync.resolve(request);
        }
        return new PromiseSync(function(resolve, reject) {
          var progressPromise = PromiseSync.resolve(null);
          $__12.forEach(filter, CursorDirection.NEXT, function(record, primaryKey) {
            progressPromise = progressPromise.then(function() {
              return $__12.delete(primaryKey);
            }, reject);
          }).then(function() {
            return resolve(progressPromise);
          });
        });
      },
      clear: function() {
        var request = this[FIELDS.objectStore].clear();
        return PromiseSync.resolve(request);
      },
      getIndex: function(indexName) {
        if (this[FIELDS.indexes].has(indexName)) {
          return this[FIELDS.indexes].get(indexName);
        }
        var nativeIndex = this[FIELDS.objectStore].index(indexName);
        var index = new Index(nativeIndex, this[FIELDS.transactionFactory]);
        this[FIELDS.indexes].set(indexName, index);
        return index;
      },
      openCursor: function(keyRange, direction, recordCallback) {
        return $traceurRuntime.superGet(this, ObjectStore.prototype, "openCursor").call(this, keyRange, direction, recordCallback);
      },
      createCursorFactory: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        return $traceurRuntime.superGet(this, ObjectStore.prototype, "createCursorFactory").call(this, keyRange, direction);
      }
    }, {}, $__super);
  }(ReadOnlyObjectStore);
  var $__default = ObjectStore;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/ObjectStore.js
