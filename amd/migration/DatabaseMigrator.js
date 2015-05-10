define(["../PromiseSync", "./RecordFetcher", "./DatabaseVersionMigrator", "../schema/DatabaseSchema", "../schema/UpgradedDatabaseSchema"], function($__0,$__2,$__4,$__6,$__8) {
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
  var PromiseSync = $__0.default;
  var RecordFetcher = $__2.default;
  var DatabaseVersionMigrator = $__4.default;
  var DatabaseSchema = $__6.default;
  var UpgradedDatabaseSchema = $__8.default;
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
  function migrateDatabase(nativeDatabase, nativeTransaction, schemaDescriptors, currentVersion) {
    var descriptorsToProcess = schemaDescriptors.filter((function(descriptor) {
      return descriptor.version > currentVersion;
    }));
    if (!descriptorsToProcess.length) {
      return PromiseSync.resolve(undefined);
    }
    return migrateDatabaseVersion(nativeDatabase, nativeTransaction, descriptorsToProcess[0]).then((function() {
      return migrateDatabase(nativeDatabase, nativeTransaction, descriptorsToProcess, descriptorsToProcess[0].version);
    }));
  }
  function migrateDatabaseVersion(nativeDatabase, nativeTransaction, descriptor) {
    var fetchPromise;
    if (descriptor.fetchBefore && descriptor.fetchBefore.length) {
      var fetcher = new RecordFetcher();
      var objectStores = normalizeFetchBeforeObjectStores(descriptor.fetchBefore);
      fetchPromise = fetcher.fetchRecords(nativeTransaction, objectStores);
    } else {
      fetchPromise = PromiseSync.resolve({});
    }
    return fetchPromise.then((function(recordsMap) {
      var versionMigrator = new DatabaseVersionMigrator(nativeDatabase, nativeTransaction, descriptor.objectStores);
      return versionMigrator.executeMigration(descriptor.after || ((function() {})), recordsMap);
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
//# sourceURL=es6/migration/DatabaseMigrator.js
