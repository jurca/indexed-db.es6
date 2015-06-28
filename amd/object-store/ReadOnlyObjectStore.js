define(["./AbstractReadOnlyStorage", "./CursorDirection", "./ReadOnlyIndex", "./query-engine"], function($__0,$__2,$__4,$__6) {
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
  var executeQuery = $__6.default;
  var FIELDS = Object.freeze({
    objectStore: Symbol("objectStore"),
    indexes: Symbol("indexes"),
    transactionFactory: Symbol("transactionFactory"),
    cursorConstructor: Symbol("cursorConstructor")
  });
  var ReadOnlyObjectStore = function($__super) {
    function ReadOnlyObjectStore(storage, cursorConstructor, transactionFactory) {
      var storageFactory = function() {
        var transaction = transactionFactory();
        return transaction.getObjectStore(storage.name);
      };
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
        var filter = arguments[0] !== (void 0) ? arguments[0] : null;
        var order = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var offset = arguments[2] !== (void 0) ? arguments[2] : 0;
        var limit = arguments[3] !== (void 0) ? arguments[3] : null;
        var records = [];
        return executeQuery(this, filter, order, offset, limit, function(record) {
          records.push(record);
        }).then(function() {
          return records;
        });
      }
    }, {}, $__super);
  }(AbstractReadOnlyStorage);
  var $__default = ReadOnlyObjectStore;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/ReadOnlyObjectStore.js
