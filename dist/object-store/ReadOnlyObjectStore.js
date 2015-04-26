define(["./AbstractReadOnlyStorage", "./ReadOnlyIndex"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var AbstractReadOnlyStorage = $__0.default;
  var ReadOnlyIndex = $__2.default;
  var FIELDS = Object.freeze({
    objectStore: Symbol("objectStore"),
    indexes: Symbol("indexes"),
    transactionFactory: Symbol("transactionFactory"),
    cursorConstructor: Symbol("cursorConstructor")
  });
  var ReadOnlyObjectStore = (function($__super) {
    function ReadOnlyObjectStore(storage, cursorConstructor, requestMonitor, transactionFactory) {
      var storageFactory = (function() {
        var transaction = transactionFactory();
        return transaction.getObjectStore(storage.name);
      });
      $traceurRuntime.superConstructor(ReadOnlyObjectStore).call(this, storage, cursorConstructor, requestMonitor, storageFactory);
      this.autoIncrement = storage.autoIncrement;
      this.indexNames = Object.freeze(Array.from(storage.indexNames));
      this[FIELDS.objectStore] = storage;
      this[FIELDS.indexes] = new Map();
      this[FIELDS.transactionFactory] = transactionFactory;
      this[FIELDS.cursorConstructor] = cursorConstructor;
      this[FIELDS.requestMonitor] = requestMonitor;
      if (this.constructor === ReadOnlyObjectStore) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyObjectStore, {getIndex: function(indexName) {
        if (this[FIELDS.indexes].has(indexName)) {
          return this[FIELDS.indexes].get(indexName);
        }
        var nativeIndex = this[FIELDS.objectStore].index(indexName);
        var index = new ReadOnlyIndex(nativeIndex, this[FIELDS.cursorConstructor], this[FIELDS.requestMonitor], this[FIELDS.transactionFactory]);
        this[FIELDS.indexes].set(indexName, index);
        return index;
      }}, {}, $__super);
  }(AbstractReadOnlyStorage));
  var $__default = ReadOnlyObjectStore;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/ReadOnlyObjectStore.js
