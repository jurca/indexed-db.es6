define(["./transaction/KeepAlive", "./transaction/ReadOnlyTransaction", "./transaction/Transaction"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var KeepAlive = $__0.default;
  var ReadOnlyTransaction = $__2.default;
  var Transaction = $__4.default;
  var TRANSACTION_MODES = Object.freeze({
    READ_ONLY: "readonly",
    READ_WRITE: "readwrite"
  });
  var FIELDS = Object.freeze({
    database: Symbol("database"),
    versionChangeListeners: Symbol("versionChangeListeners"),
    transactionCommitDelay: Symbol("transactionCommitDelay")
  });
  var Database = (function() {
    function Database(database, transactionCommitDelay) {
      var $__6 = this;
      this.name = database.name;
      this.version = database.version;
      this.objectStoreNames = Object.freeze(Array.from(database.objectStoreNames));
      this[FIELDS.database] = database;
      this[FIELDS.versionChangeListeners] = new Set();
      this[FIELDS.transactionCommitDelay] = transactionCommitDelay;
      database.onversionchange = (function(event) {
        var newVersion = event.newVersion;
        $__6[FIELDS.versionChangeListeners].forEach((function(listener) {
          try {
            listener(newVersion);
          } catch (error) {
            console.error("An event listener threw an error", error);
          }
        }));
      });
      this.addVersionChangeListener((function() {
        if ($__6[FIELDS.versionChangeListeners].size !== 1) {
          return ;
        }
        console.warn("The database just received a versionchange event, but " + "no custom event listener has been registered for this event. " + "The connection to the database will therefore remain open and " + "the database upgrade will be blocked");
      }));
    }
    return ($traceurRuntime.createClass)(Database, {
      addVersionChangeListener: function(listener) {
        this[FIELDS.versionChangeListeners].add(listener);
      },
      startTransaction: function() {
        for (var objectStoreNames = [],
            $__8 = 0; $__8 < arguments.length; $__8++)
          objectStoreNames[$__8] = arguments[$__8];
        var $__6 = this;
        if (objectStoreNames[0] instanceof Array) {
          objectStoreNames = objectStoreNames[0];
        }
        var nativeTransaction = this[FIELDS.database].transaction(objectStoreNames, TRANSACTION_MODES.READ_WRITE);
        var keepAliveObjectStore = objectStoreNames[0];
        var keepAlive = new KeepAlive((function() {
          return nativeTransaction.objectStore(keepAliveObjectStore);
        }), this[FIELDS.transactionCommitDelay]);
        return new Transaction(nativeTransaction, (function(objectStoreName) {
          return $__6.startReadOnlyTransaction(objectStoreName);
        }), keepAlive);
      },
      startReadOnlyTransaction: function() {
        for (var objectStoreNames = [],
            $__9 = 0; $__9 < arguments.length; $__9++)
          objectStoreNames[$__9] = arguments[$__9];
        var $__6 = this;
        if (objectStoreNames[0] instanceof Array) {
          objectStoreNames = objectStoreNames[0];
        }
        var nativeTransaction = this[FIELDS.database].transaction(objectStoreNames, TRANSACTION_MODES.READ_ONLY);
        var keepAliveObjectStore = objectStoreNames[0];
        var keepAlive = new KeepAlive((function() {
          return nativeTransaction.objectStore(keepAliveObjectStore);
        }), this[FIELDS.transactionCommitDelay]);
        return new ReadOnlyTransaction(nativeTransaction, (function(objectStoreName) {
          return $__6.startReadOnlyTransaction(objectStoreName);
        }), keepAlive);
      },
      getObjectStore: function(objectStoreName) {
        var transaction = this.startReadOnlyTransaction(objectStoreName);
        return transaction.getObjectStore(objectStoreName);
      },
      runTransaction: function(objectStoreNames, transactionOperations) {
        var $__10;
        if (typeof objectStoreNames === "string") {
          objectStoreNames = [objectStoreNames];
        }
        var transaction = ($__10 = this).startTransaction.apply($__10, $traceurRuntime.spread(objectStoreNames));
        return runTransaction(transaction, objectStoreNames, transactionOperations);
      },
      runReadOnlyTransaction: function(objectStoreNames, transactionOperations) {
        var $__10;
        if (typeof objectStoreNames === "string") {
          objectStoreNames = [objectStoreNames];
        }
        var transaction = ($__10 = this).startReadOnlyTransaction.apply($__10, $traceurRuntime.spread(objectStoreNames));
        return runTransaction(transaction, objectStoreNames, transactionOperations);
      },
      close: function() {
        this[FIELDS.database].close();
      }
    }, {});
  }());
  var $__default = Database;
  function runTransaction(transaction, objectStoreNames, transactionOperations) {
    var objectStores = objectStoreNames.map((function(objectStoreName) {
      return transaction.getObjectStore(objectStoreName);
    }));
    var resultPromise = transactionOperations.apply((void 0), $traceurRuntime.spread(objectStores));
    return Promise.resolve(resultPromise).then((function(result) {
      transaction.commit();
      return transaction.completionPromise.then((function() {
        return result;
      }));
    }));
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/Database.js
