define(["../PromiseSync", "../transaction/Transaction", "./ObjectStoreMigrator"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var PromiseSync = $__0.default;
  var Transaction = $__2.default;
  var ObjectStoreMigrator = $__4.default;
  var FIELDS = Object.freeze({
    databaseName: Symbol("databaseName"),
    targetVersion: Symbol("targetVersion"),
    objectStores: Symbol("objectStores")
  });
  var DatabaseVersionMigrator = (function() {
    function DatabaseVersionMigrator(databaseName, targetVersion, objectStores) {
      this[FIELDS.databaseName] = databaseName;
      this[FIELDS.targetVersion] = targetVersion;
      this[FIELDS.objectStores] = objectStores;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(DatabaseVersionMigrator, {executeMigration: function(onComplete, callbackData) {
        var $__6 = this;
        var openedDatabase;
        var request = indexedDB.open(this[FIELDS.databaseName], this[FIELDS.targetVersion]);
        return openConnection(request, (function(nativeDatabase, nativeTransaction) {
          openedDatabase = nativeDatabase;
          var objectStores = $__6[FIELDS.objectStores];
          upgradeSchema(nativeDatabase, nativeTransaction, objectStores);
          var objectStoreNames = $__6[FIELDS.objectStores].map((function(objectStore) {
            return objectStore.name;
          }));
          var transaction = new Transaction(nativeTransaction, (function() {
            return transaction;
          }));
          try {
            return PromiseSync.resolve(onComplete(transaction, callbackData));
          } catch (error) {
            return PromiseSync.reject(error);
          }
        })).catch((function(error) {
          if (openedDatabase) {
            openedDatabase.close();
          }
          throw error;
        }));
      }}, {});
  }());
  var $__default = DatabaseVersionMigrator;
  function upgradeSchema(nativeDatabase, nativeTransaction, descriptors) {
    var objectStoreNames = Array.from(nativeDatabase.objectStoreNames);
    var newObjectStoreNames = descriptors.map((function(objectStore) {
      return objectStore.name;
    }));
    objectStoreNames.forEach((function(objectStoreName) {
      if (newObjectStoreNames.indexOf(objectStoreName) === -1) {
        nativeDatabase.deleteObjectStore(objectStoreName);
      }
    }));
    descriptors.forEach((function(objectStoreDescriptor) {
      var objectStoreName = objectStoreDescriptor.name;
      var nativeObjectStore = objectStoreNames.indexOf(objectStoreName) > -1 ? nativeTransaction.objectStore(objectStoreName) : null;
      var objectStoreMigrator = new ObjectStoreMigrator(nativeDatabase, nativeObjectStore, objectStoreDescriptor);
      objectStoreMigrator.executeMigration();
    }));
  }
  function openConnection(request, onUpgradeReady) {
    return new Promise((function(resolve, reject) {
      var wasBlocked = false;
      var upgradeTrigerred = false;
      var upgradeExecuted = false;
      request.onsuccess = (function() {
        var database = request.result;
        database.close();
        if (!upgradeExecuted) {
          reject(new Error("The database was already at version " + database.version));
        }
        resolve();
      });
      request.onupgradeneeded = (function() {
        if (wasBlocked) {
          request.transaction.abort();
          return ;
        }
        upgradeTrigerred = true;
        onUpgradeReady(request.result, request.transaction).catch((function(error) {
          reject(error);
          request.transaction.abort();
        }));
        upgradeExecuted = true;
      });
      request.onerror = (function(event) {
        if (wasBlocked || upgradeTrigerred) {
          event.preventDefault();
          return ;
        }
        reject(request.error);
      });
      request.onblocked = (function() {
        wasBlocked = true;
        var error = new Error("The database upgrade could not be performed " + "because the attempt was blocked by a connection that remained " + "opened after receiving the notification");
        reject(error);
      });
    }));
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/migration/DatabaseVersionMigrator.js
