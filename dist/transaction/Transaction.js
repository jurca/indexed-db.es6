define(["../object-store/ObjectStore", "./ReadOnlyTransaction"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var ObjectStore = $__0.default;
  var ReadOnlyTransaction = $__2.default;
  var FIELDS = Object.freeze({
    transaction: Symbol("transaction"),
    transactionFactory: Symbol("transactionFactory"),
    objectStores: Symbol("objectStores")
  });
  var Transaction = (function($__super) {
    function Transaction(transaction, transactionFactory) {
      $traceurRuntime.superConstructor(Transaction).call(this, transaction, transactionFactory);
      this[FIELDS.transaction] = transaction;
      this[FIELDS.transactionFactory] = transactionFactory;
      this[FIELDS.objectStores] = new Map();
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(Transaction, {getObjectStore: function(objectStoreName) {
        var $__4 = this;
        if (this[FIELDS.objectStores].has(objectStoreName)) {
          return this[FIELDS.objectStores].get(objectStoreName);
        }
        var transactionFactory = (function() {
          return $__4[FIELDS.transactionFactory](objectStoreName);
        });
        var idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName);
        var objectStore = new ObjectStore(idbObjectStore, transactionFactory);
        this[FIELDS.objectStores].set(objectStoreName, objectStore);
        return objectStore;
      }}, {}, $__super);
  }(ReadOnlyTransaction));
  var $__default = Transaction;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/transaction/Transaction.js
