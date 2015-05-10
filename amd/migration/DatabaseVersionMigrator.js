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
    database: Symbol("database"),
    transaction: Symbol("transaction"),
    objectStores: Symbol("objectStores")
  });
  var DatabaseVersionMigrator = (function() {
    function DatabaseVersionMigrator(database, transaction, objectStores) {
      this[FIELDS.database] = database;
      this[FIELDS.transaction] = transaction;
      this[FIELDS.objectStores] = objectStores;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(DatabaseVersionMigrator, {executeMigration: function(onComplete, callbackData) {
        var nativeDatabase = this[FIELDS.database];
        var nativeTransaction = this[FIELDS.transaction];
        var objectStores = this[FIELDS.objectStores];
        upgradeSchema(nativeDatabase, nativeTransaction, objectStores);
        return PromiseSync.resolve().then((function() {
          var transaction = new Transaction(nativeTransaction, (function() {
            return transaction;
          }));
          transaction.completionPromise.catch((function() {}));
          var promise = PromiseSync.resolve(onComplete(transaction, callbackData));
          return promise.then((function() {
            return undefined;
          }));
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
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/migration/DatabaseVersionMigrator.js
