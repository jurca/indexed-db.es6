define(["./KeepAlive", "../object-store/ReadOnlyObjectStore", "../object-store/ReadOnlyCursor"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var KeepAlive = $__0.default;
  var ReadOnlyObjectStore = $__2.default;
  var ReadOnlyCursor = $__4.default;
  var FIELDS = Object.freeze({
    transaction: Symbol("transaction"),
    transactionFactory: Symbol("transactionFactory"),
    objectStores: Symbol("objectStores"),
    completeListeners: Symbol("completeListeners"),
    abortListeners: Symbol("abortListeners"),
    errorListeners: Symbol("errorListeners"),
    keepAlive: Symbol("keepAlive")
  });
  var ReadOnlyTransaction = (function() {
    function ReadOnlyTransaction(transaction, transactionFactory, keepAlive) {
      var $__6 = this;
      this[FIELDS.transaction] = transaction;
      this[FIELDS.transactionFactory] = transactionFactory;
      this[FIELDS.objectStores] = new Map();
      this[FIELDS.completeListeners] = new Set();
      this[FIELDS.abortListeners] = new Set();
      this[FIELDS.errorListeners] = new Set();
      this[FIELDS.keepAlive] = keepAlive;
      this.completionPromise = new Promise((function(resolve, reject) {
        $__6.addCompleteListener(resolve);
        $__6.addAbortListener((function() {
          reject(new Error("The transaction has been aborted"));
        }));
        $__6.addErrorListener(reject);
      }));
      transaction.oncomplete = (function() {
        executeEventListeners($__6[FIELDS.completeListeners]);
      });
      transaction.onabort = (function() {
        executeEventListeners($__6[FIELDS.abortListeners]);
      });
      transaction.onerror = (function() {
        executeEventListeners($__6[FIELDS.errorListeners], transaction.error);
      });
      this.addErrorListener((function(error) {
        if ($__6[FIELDS.errorListeners].size < 2) {
          console.error("Encountered an uncaptured transaction-level error " + "while no error listeners were registered", error);
        }
      }));
      if (this.constructor === ReadOnlyTransaction) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyTransaction, {
      addCompleteListener: function(listener) {
        this[FIELDS.completeListeners].add(listener);
      },
      addAbortListener: function(listener) {
        this[FIELDS.abortListeners].add(listener);
      },
      addErrorListener: function(listener) {
        this[FIELDS.errorListeners].add(listener);
      },
      abort: function() {
        this[FIELDS.keepAlive].terminate();
        this[FIELDS.transaction].abort();
      },
      commit: function() {
        this[FIELDS.keepAlive].terminate();
      },
      getObjectStore: function(objectStoreName) {
        var $__6 = this;
        if (this[FIELDS.objectStores].has(objectStoreName)) {
          return this[FIELDS.objectStores].get(objectStoreName);
        }
        var transactionFactory = (function() {
          return $__6[FIELDS.transactionFactory](objectStoreName);
        });
        var idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName);
        var objectStore = new ReadOnlyObjectStore(idbObjectStore, ReadOnlyCursor, this[FIELDS.keepAlive].requestMonitor, transactionFactory);
        this[FIELDS.objectStores].set(objectStoreName, objectStore);
        return objectStore;
      }
    }, {});
  }());
  var $__default = ReadOnlyTransaction;
  function executeEventListeners(listeners) {
    for (var parameters = [],
        $__8 = 1; $__8 < arguments.length; $__8++)
      parameters[$__8 - 1] = arguments[$__8];
    listeners.forEach((function(listener) {
      try {
        listener.apply(null, parameters);
      } catch (error) {
        console.error("An event listener threw an error", error);
      }
    }));
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/transaction/ReadOnlyTransaction.js
