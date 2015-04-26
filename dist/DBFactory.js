define(["./Database", "./migration/DatabaseMigrator"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Database = $__0.default;
  var DatabaseMigrator = $__2.default;
  var migrationListeners = new Set();
  var DBFactory = (function() {
    function DBFactory() {}
    return ($traceurRuntime.createClass)(DBFactory, {}, {
      open: function(databaseName) {
        for (var schemaDescriptors = [],
            $__12 = 1; $__12 < arguments.length; $__12++)
          schemaDescriptors[$__12 - 1] = arguments[$__12];
        if (!schemaDescriptors.length) {
          throw new Error("The list of schema descriptors must not be empty");
        }
        var sortedSchemaDescriptors = schemaDescriptors.slice().sort((function(d1, d2) {
          return d1.version - d2.version;
        }));
        var requestedVersion = sortedSchemaDescriptors.slice().pop().version;
        var request = indexedDB.open(databaseName, requestedVersion);
        return openConnection(request, sortedSchemaDescriptors);
      },
      deleteDatabase: function(databaseName) {
        var request = indexedDB.deleteDatabase(databaseName);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function(event) {
            return resolve(event.oldVersion);
          });
          request.onerror = (function(event) {
            return reject(event);
          });
        }));
      },
      addMigrationListener: function(listener) {
        migrationListeners.add(listener);
      },
      removeMigrationListener: function(listener) {
        migrationListeners.delete(listener);
      }
    });
  }());
  var $__default = DBFactory;
  function openConnection(request, sortedSchemaDescriptors) {
    return new Promise((function(resolve, reject) {
      var wasBlocked = false;
      var migrationPromiseResolver,
          migrationPromiseRejector;
      var migrationPromise = new Promise((function(resolve, reject) {
        migrationPromiseResolver = resolve;
        migrationPromiseRejector = reject;
      }));
      migrationPromise.catch((function() {}));
      request.onsuccess = (function() {
        var database = new Database(request.result);
        resolve(database);
        migrationPromiseResolver();
      });
      request.onupgradeneeded = (function(event) {
        var database = request.result;
        var transaction = request.transaction;
        if (wasBlocked) {
          transaction.abort();
          return ;
        }
        executeMigrationListeners(database.name, event.oldVersion, event.newVersion, migrationPromise);
        database.onerror = (function(errorEvent) {
          reject(errorEvent);
          migrationPromiseRejector(errorEvent);
        });
        try {
          var migrator = new DatabaseMigrator(database, transaction, sortedSchemaDescriptors, event.oldVersion);
          migrator.executeMigration().catch((function(error) {
            transaction.abort();
            reject(error);
            migrationPromiseRejector(error);
          }));
        } catch (error) {
          transaction.abort();
          reject(error);
          migrationPromiseRejector(error);
        }
      });
      request.onerror = (function(event) {
        if (wasBlocked) {
          event.preventDefault();
          return ;
        }
        reject(request.error);
        migrationPromiseRejector(request.error);
      });
      request.onblocked = (function() {
        wasBlocked = true;
        var error = new Error("A database upgrade was needed, but could not " + "be performed, because the attempt was blocked by a connection " + "that remained opened after receiving the notification");
        reject(error);
        migrationPromiseRejector(error);
      });
    }));
  }
  function executeMigrationListeners(databaseName, oldVersion, newVersion, completionPromise) {
    var $__8 = true;
    var $__9 = false;
    var $__10 = undefined;
    try {
      for (var $__6 = void 0,
          $__5 = (migrationListeners)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__8 = ($__6 = $__5.next()).done); $__8 = true) {
        var listener = $__6.value;
        {
          try {
            listener(databaseName, oldVersion, newVersion, completionPromise);
          } catch (e) {
            console.warn("A schema migration event listener threw an error", e);
          }
        }
      }
    } catch ($__11) {
      $__9 = true;
      $__10 = $__11;
    } finally {
      try {
        if (!$__8 && $__5.return != null) {
          $__5.return();
        }
      } finally {
        if ($__9) {
          throw $__10;
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
//# sourceURL=src/DBFactory.js
