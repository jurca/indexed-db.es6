define(["./transaction/ReadOnlyTransaction", "./transaction/Transaction"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var ReadOnlyTransaction = $__0.default;
  var Transaction = $__2.default;
  var TRANSACTION_MODES = Object.freeze({
    READ_ONLY: "readonly",
    READ_WRITE: "readwrite"
  });
  var FIELDS = Object.freeze({
    database: Symbol("database"),
    versionChangeListeners: Symbol("versionChangeListeners"),
    activeTransactions: Symbol("activeTransactions")
  });
  var Database = function() {
    function Database(database) {
      var $__4 = this;
      this.name = database.name;
      this.version = database.version;
      this.objectStoreNames = Object.freeze(Array.from(database.objectStoreNames));
      this[FIELDS.database] = database;
      this[FIELDS.versionChangeListeners] = new Set();
      this[FIELDS.activeTransactions] = new Set();
      database.onversionchange = function(event) {
        var newVersion = event.newVersion;
        $__4[FIELDS.versionChangeListeners].forEach(function(listener) {
          try {
            listener(newVersion);
          } catch (error) {
            console.error("An event listener threw an error", error);
          }
        });
      };
      this.addVersionChangeListener(function() {
        if ($__4[FIELDS.versionChangeListeners].size !== 1) {
          return;
        }
        console.warn("The database just received a versionchange event, but " + "no custom event listener has been registered for this event. " + "The connection to the database will therefore remain open and " + "the database upgrade will be blocked");
      });
    }
    return ($traceurRuntime.createClass)(Database, {
      addVersionChangeListener: function(listener) {
        this[FIELDS.versionChangeListeners].add(listener);
      },
      startTransaction: function() {
        for (var objectStoreNames = [],
            $__6 = 0; $__6 < arguments.length; $__6++)
          objectStoreNames[$__6] = arguments[$__6];
        var $__4 = this;
        if (objectStoreNames[0] instanceof Array) {
          objectStoreNames = objectStoreNames[0];
        }
        var nativeTransaction = this[FIELDS.database].transaction(objectStoreNames, TRANSACTION_MODES.READ_WRITE);
        var transaction = new Transaction(nativeTransaction, function(objectStoreName) {
          return $__4.startReadOnlyTransaction(objectStoreName);
        });
        this[FIELDS.activeTransactions].add(transaction);
        transaction.completionPromise.catch(function() {}).then(function() {
          $__4[FIELDS.activeTransactions].delete(transaction);
        });
        return transaction;
      },
      startReadOnlyTransaction: function() {
        for (var objectStoreNames = [],
            $__7 = 0; $__7 < arguments.length; $__7++)
          objectStoreNames[$__7] = arguments[$__7];
        var $__4 = this;
        if (objectStoreNames[0] instanceof Array) {
          objectStoreNames = objectStoreNames[0];
        }
        var nativeTransaction = this[FIELDS.database].transaction(objectStoreNames, TRANSACTION_MODES.READ_ONLY);
        var transaction = new ReadOnlyTransaction(nativeTransaction, function(objectStoreName) {
          return $__4.startReadOnlyTransaction(objectStoreName);
        });
        this[FIELDS.activeTransactions].add(transaction);
        transaction.completionPromise.catch(function() {}).then(function() {
          $__4[FIELDS.activeTransactions].delete(transaction);
        });
        return transaction;
      },
      getObjectStore: function(objectStoreName) {
        var transaction = this.startReadOnlyTransaction(objectStoreName);
        return transaction.getObjectStore(objectStoreName);
      },
      runTransaction: function(objectStoreNames, transactionOperations) {
        var $__8;
        if (typeof objectStoreNames === "string") {
          objectStoreNames = [objectStoreNames];
        }
        var transaction = ($__8 = this).startTransaction.apply($__8, $traceurRuntime.spread(objectStoreNames));
        return runTransaction(transaction, objectStoreNames, transactionOperations);
      },
      runReadOnlyTransaction: function(objectStoreNames, transactionOperations) {
        var $__8;
        if (typeof objectStoreNames === "string") {
          objectStoreNames = [objectStoreNames];
        }
        var transaction = ($__8 = this).startReadOnlyTransaction.apply($__8, $traceurRuntime.spread(objectStoreNames));
        return runTransaction(transaction, objectStoreNames, transactionOperations);
      },
      close: function() {
        this[FIELDS.database].close();
        var transactions = Array.from(this[FIELDS.activeTransactions]);
        return Promise.all(transactions.map(function(transaction) {
          return transaction.completionPromise;
        })).catch(function() {}).then(function() {});
      }
    }, {});
  }();
  var $__default = Database;
  function runTransaction(transaction, objectStoreNames, transactionOperations) {
    var callbackArguments = objectStoreNames.map(function(objectStoreName) {
      return transaction.getObjectStore(objectStoreName);
    });
    callbackArguments.push(function() {
      return transaction.abort();
    });
    var resultPromise = transactionOperations.apply((void 0), $traceurRuntime.spread(callbackArguments));
    return Promise.resolve(resultPromise).then(function(result) {
      return transaction.completionPromise.then(function() {
        return result;
      });
    });
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/Database.js
