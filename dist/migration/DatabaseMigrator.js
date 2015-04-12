define(["./ObjectStoreMigrator", "../schema/DatabaseSchema", "../schema/UpgradedDatabaseSchema", "../transaction/ReadOnlyTransaction", "../transaction/Transaction"], function($__0,$__2,$__4,$__6,$__8) {
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
  var ObjectStoreMigrator = $__0.default;
  var DatabaseSchema = $__2.default;
  var UpgradedDatabaseSchema = $__4.default;
  var ReadOnlyTransaction = $__6.default;
  var Transaction = $__8.default;
  var FIELDS = Object.freeze({
    database: Symbol("database"),
    transaction: Symbol("transaction"),
    schemaDescriptors: Symbol("schemaDescriptors"),
    currentVersion: Symbol("currentVersion")
  });
  var DatabaseMigrator = (function() {
    function DatabaseMigrator(database, transaction, schemaDescriptors, currentVersion) {
      if (!schemaDescriptors.length) {
        throw new Error("The list of schema descriptors cannot be empty");
      }
      var sortedSchemasCopy = schemaDescriptors.slice().sort((function(desc1, desc2) {
        return desc1.version - desc2.version;
      }));
      checkSchemaDescriptorTypes(sortedSchemasCopy);
      var isVersionValid = (currentVersion >= 0) && (parseInt(currentVersion, 10) === currentVersion);
      if (!isVersionValid) {
        throw new Error("The version number must be either a positive " + "integer, or 0 if the database is being created");
      }
      this[FIELDS.database] = database;
      this[FIELDS.transaction] = transaction;
      this[FIELDS.schemaDescriptors] = Object.freeze(sortedSchemasCopy);
      this[FIELDS.currentVersion] = currentVersion;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(DatabaseMigrator, {executeMigration: function() {
        return migrateDatabase(this[FIELDS.database], this[FIELDS.transaction], this[FIELDS.schemaDescriptors], this[FIELDS.currentVersion]);
      }}, {});
  }());
  var $__default = DatabaseMigrator;
  function migrateDatabase(database, transaction, schemaDescriptors, currentVersion) {
    var descriptorsToProcess = schemaDescriptors.filter((function(descriptor) {
      return descriptor.version > currentVersion;
    }));
    if (!descriptorsToProcess.length) {
      return Promise.resolve(undefined);
    }
    return migrateDatabaseVersion(database, transaction, descriptorsToProcess[0]).then((function() {
      return migrateDatabase(database, transaction, descriptorsToProcess, descriptorsToProcess[0].version);
    }));
  }
  function migrateDatabaseVersion(database, nativeTransaction, descriptor) {
    var transaction = new Transaction(nativeTransaction, (function() {
      return nativeTransaction;
    }));
    var objectStores = descriptor.fetchBefore || [];
    return fetchRecords(transaction, objectStores).then((function(recordsMap) {
      upgradeSchema(database, nativeTransaction, descriptor);
      if (descriptor.after) {
        return Promise.resolve(descriptor.after(transaction, recordsMap));
      }
    }));
  }
  function upgradeSchema(database, nativeTransaction, descriptor) {
    var objectStoreNames = Array.from(database.objectStoreNames);
    var newObjectStoreNames = descriptor.objectStores.map((function(objectStore) {
      return objectStore.name;
    }));
    objectStoreNames.forEach((function(objectStoreName) {
      if (newObjectStoreNames.indexOf(objectStoreName) === -1) {
        database.deleteObjectStore(objectStoreName);
      }
    }));
    descriptor.objectStores.forEach((function(objectStoreDescriptor) {
      var objectStoreName = objectStoreDescriptor.name;
      var nativeObjectStore = objectStoreNames.indexOf(objectStoreName) > -1 ? nativeTransaction.objectStore(objectStoreName) : null;
      var objectStoreMigrator = new ObjectStoreMigrator(database, nativeObjectStore, objectStoreDescriptor);
      objectStoreMigrator.executeMigration();
    }));
  }
  function fetchRecords(transaction, objectStores) {
    if (!objectStores.length) {
      return Promise.resolve({});
    }
    var normalizedObjectStores = normalizeFetchBeforeObjectStores(objectStores);
    return new Promise((function(resolveAll, rejectAll) {
      Promise.all(normalizedObjectStores.map((function(objectStore) {
        return fetchObjectStoreRecords(transaction.getObjectStore(objectStore.objectStore), objectStore.preprocessor);
      }))).then((function(fetchedRecords) {
        var recordsMap = {};
        for (var i = 0; i < objectStores.length; i++) {
          recordsMap[normalizedObjectStores[i].objectStore] = fetchedRecords[i];
        }
        resolveAll(recordsMap);
      })).catch(rejectAll);
    }));
  }
  function fetchObjectStoreRecords(objectStore, preprocessor) {
    return new Promise((function(resolve, reject) {
      var records = [];
      var cursorPromise = objectStore.openCursor();
      cursorPromise.then(iterate).catch(reject);
      function iterate(cursor) {
        if (cursor.done) {
          resolve(records);
          return ;
        }
        var preprocessed = preprocessor(cursor.record, cursor.primaryKey);
        if (preprocessed === UpgradedDatabaseSchema.DELETE_RECORD) {
          cursor.delete().then((function() {
            return cursor.advance();
          })).then(iterate).catch(reject);
          return ;
        } else if (preprocessed !== UpgradedDatabaseSchema.SKIP_RECORD) {
          records.push({
            key: cursor.primaryKey,
            record: preprocessed
          });
        } else {}
        cursor.advance().then(iterate).catch(reject);
      }
    }));
  }
  function normalizeFetchBeforeObjectStores(objectStores) {
    return objectStores.map((function(objectStore) {
      if (typeof objectStore === "string") {
        return {
          objectStore: objectStore,
          preprocessor: (function(record) {
            return record;
          })
        };
      } else if (!objectStore.preprocessor) {
        return {
          objectStore: objectStore.objectStore,
          preprocessor: (function(record) {
            return record;
          })
        };
      } else {
        return objectStore;
      }
    }));
  }
  function checkSchemaDescriptorTypes(schemaDescriptors) {
    var onlyPlainObjects = schemaDescriptors.every((function(descriptor) {
      return descriptor.constructor === Object;
    }));
    if (onlyPlainObjects) {
      return ;
    }
    if (!(schemaDescriptors[0] instanceof DatabaseSchema)) {
      throw new TypeError("The schema descriptor of the lowest described " + ("database version (" + schemaDescriptors[0].version + ") must be a ") + "DatabaseSchema instance, or all schema descriptors must be plain " + "objects");
    }
    schemaDescriptors.slice(1).forEach((function(descriptor) {
      if (!(descriptor instanceof UpgradedDatabaseSchema)) {
        throw new TypeError("The schema descriptors of the upgraded database " + "versions must be UpgradedDatabaseSchema instances, but the " + ("provided descriptor of version " + descriptor.version + " was not an ") + "UpgradedDatabaseSchema instance, or all schema descriptors must " + "be plain objects");
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
//# sourceURL=src/migration/DatabaseMigrator.js
