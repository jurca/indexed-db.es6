define(["../object-store/ReadOnlyObjectStore", "../object-store/ReadOnlyCursor"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var ReadOnlyObjectStore = $__0.default;
  var ReadOnlyCursor = $__2.default;
  var FIELDS = Object.freeze({
    transaction: Symbol("transaction"),
    transactionFactory: Symbol("transactionFactory"),
    objectStores: Symbol("objectStores"),
    completeListeners: Symbol("completeListeners"),
    abortListeners: Symbol("abortListeners"),
    errorListeners: Symbol("errorListeners")
  });
  var ReadOnlyTransaction = function() {
    function ReadOnlyTransaction(transaction, transactionFactory) {
      var $__4 = this;
      this[FIELDS.transaction] = transaction;
      this[FIELDS.transactionFactory] = transactionFactory;
      this[FIELDS.objectStores] = new Map();
      this[FIELDS.completeListeners] = new Set();
      this[FIELDS.abortListeners] = new Set();
      this[FIELDS.errorListeners] = new Set();
      this.completionPromise = new Promise(function(resolve, reject) {
        $__4.addCompleteListener(resolve);
        $__4.addAbortListener(function() {
          reject(new Error("The transaction has been aborted"));
        });
        $__4.addErrorListener(reject);
      });
      transaction.oncomplete = function() {
        executeEventListeners($__4[FIELDS.completeListeners]);
      };
      transaction.onabort = function() {
        executeEventListeners($__4[FIELDS.abortListeners]);
      };
      transaction.onerror = function(event) {
        executeEventListeners($__4[FIELDS.errorListeners], transaction.error);
        event.preventDefault();
      };
      this.addErrorListener(function(error) {
        if ($__4[FIELDS.errorListeners].size < 2) {
          console.error("Encountered an uncaptured transaction-level error " + "while no error listeners were registered", error);
        }
      });
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
        this[FIELDS.transaction].abort();
      },
      getObjectStore: function(objectStoreName) {
        var $__4 = this;
        if (this[FIELDS.objectStores].has(objectStoreName)) {
          return this[FIELDS.objectStores].get(objectStoreName);
        }
        var transactionFactory = function() {
          return $__4[FIELDS.transactionFactory](objectStoreName);
        };
        var idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName);
        var objectStore = new ReadOnlyObjectStore(idbObjectStore, ReadOnlyCursor, transactionFactory);
        this[FIELDS.objectStores].set(objectStoreName, objectStore);
        return objectStore;
      }
    }, {});
  }();
  var $__default = ReadOnlyTransaction;
  function executeEventListeners(listeners) {
    for (var parameters = [],
        $__6 = 1; $__6 < arguments.length; $__6++)
      parameters[$__6 - 1] = arguments[$__6];
    listeners.forEach(function(listener) {
      try {
        listener.apply(null, parameters);
      } catch (error) {
        console.error("An event listener threw an error", error);
      }
    });
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/transaction/ReadOnlyTransaction.js
