define(["./Database", "./NativeDBAccessor", "./PromiseSync", "./migration/DatabaseMigrator"], function($__0,$__2,$__4,$__6) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var Database = $__0.default;
  var NativeDBAccessor = $__2.default;
  var PromiseSync = $__4.default;
  var DatabaseMigrator = $__6.default;
  var migrationListeners = new Set();
  var DBFactory = function() {
    function DBFactory() {}
    return ($traceurRuntime.createClass)(DBFactory, {}, {
      open: function(databaseName) {
        for (var schemaDescriptors = [],
            $__16 = 1; $__16 < arguments.length; $__16++)
          schemaDescriptors[$__16 - 1] = arguments[$__16];
        if (!schemaDescriptors.length) {
          throw new Error("The list of schema descriptors must not be empty");
        }
        var sortedSchemaDescriptors = schemaDescriptors.slice().sort(function(d1, d2) {
          return d1.version - d2.version;
        });
        return openConnection(databaseName, sortedSchemaDescriptors);
      },
      deleteDatabase: function(databaseName) {
        var request = NativeDBAccessor.indexedDB.deleteDatabase(databaseName);
        return new Promise(function(resolve, reject) {
          request.onsuccess = function(event) {
            return resolve(event.oldVersion);
          };
          request.onerror = function(event) {
            return reject(event);
          };
        });
      },
      addMigrationListener: function(listener) {
        migrationListeners.add(listener);
      },
      removeMigrationListener: function(listener) {
        migrationListeners.delete(listener);
      },
      set nativeIndexedDB(indexedDBImplementation) {
        NativeDBAccessor.indexedDB = indexedDBImplementation;
      },
      get nativeIndexedDB() {
        return NativeDBAccessor.indexedDB;
      }
    });
  }();
  var $__default = DBFactory;
  function openConnection(databaseName, sortedSchemaDescriptors) {
    var version = sortedSchemaDescriptors.slice().pop().version;
    var request = NativeDBAccessor.indexedDB.open(databaseName, version);
    return new Promise(function(resolve, reject) {
      var wasBlocked = false;
      var upgradeTriggered = false;
      var migrationPromiseResolver,
          migrationPromiseRejector;
      var migrationPromise = new Promise(function(resolve, reject) {
        migrationPromiseResolver = resolve;
        migrationPromiseRejector = reject;
      });
      migrationPromise.catch(function() {});
      request.onsuccess = function() {
        var database = new Database(request.result);
        resolve(database);
        migrationPromiseResolver();
      };
      request.onupgradeneeded = function(event) {
        if (!wasBlocked) {
          upgradeTriggered = true;
        }
        var database = request.result;
        var transaction = request.transaction;
        if (wasBlocked) {
          transaction.abort();
          return;
        }
        upgradeDatabaseSchema(databaseName, event, migrationPromise, database, transaction, sortedSchemaDescriptors, migrationPromiseResolver, migrationPromiseRejector).catch(function(error) {
          transaction.abort();
        });
      };
      request.onerror = function(event) {
        handleConnectionError(event, request.error, wasBlocked, upgradeTriggered, reject, migrationPromiseRejector);
      };
      request.onblocked = function() {
        wasBlocked = true;
        var error = new Error("A database upgrade was needed, but could not " + "be performed, because the attempt was blocked by a connection " + "that remained opened after receiving the notification");
        reject(error);
        migrationPromiseRejector(error);
      };
    });
  }
  function handleConnectionError(event, error, wasBlocked, upgradeTriggered, reject, migrationPromiseRejector) {
    if (wasBlocked || upgradeTriggered) {
      event.preventDefault();
      return;
    }
    reject(request.error);
    migrationPromiseRejector(request.error);
  }
  function upgradeDatabaseSchema(databaseName, event, migrationPromise, database, transaction, sortedSchemaDescriptors, migrationPromiseResolver, migrationPromiseRejector) {
    executeMigrationListeners(databaseName, event.oldVersion, event.newVersion, migrationPromise);
    var migrator = new DatabaseMigrator(database, transaction, sortedSchemaDescriptors, event.oldVersion);
    return PromiseSync.resolve().then(function() {
      return migrator.executeMigration();
    }).then(function() {
      migrationPromiseResolver();
    }).catch(function(error) {
      migrationPromiseRejector(error);
      throw error;
    });
  }
  function executeMigrationListeners(databaseName, oldVersion, newVersion, completionPromise) {
    var $__12 = true;
    var $__13 = false;
    var $__14 = undefined;
    try {
      for (var $__10 = void 0,
          $__9 = (migrationListeners)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__12 = ($__10 = $__9.next()).done); $__12 = true) {
        var listener = $__10.value;
        {
          try {
            listener(databaseName, oldVersion, newVersion, completionPromise);
          } catch (e) {
            console.warn("A schema migration event listener threw an error", e);
          }
        }
      }
    } catch ($__15) {
      $__13 = true;
      $__14 = $__15;
    } finally {
      try {
        if (!$__12 && $__9.return != null) {
          $__9.return();
        }
      } finally {
        if ($__13) {
          throw $__14;
        }
      }
    }
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/DBFactory.js
