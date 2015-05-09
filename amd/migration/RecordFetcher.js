define(["../Database", "../object-store/CursorDirection", "../schema/UpgradedDatabaseSchema"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var Database = $__0.default;
  var CursorDirection = $__2.default;
  var UpgradedDatabaseSchema = $__4.default;
  var RecordFetcher = (function() {
    function RecordFetcher() {}
    return ($traceurRuntime.createClass)(RecordFetcher, {fetchRecords: function(databaseName, objectStores) {
        if (!objectStores.length) {
          throw new Error("The object stores array cannot be empty");
        }
        var request = indexedDB.open(databaseName);
        var objectStoreNames = objectStores.map((function(descriptor) {
          return descriptor.objectStore;
        }));
        var openedDatabase;
        return openConnection(request, objectStoreNames).then((function(nativeDatabase) {
          openedDatabase = nativeDatabase;
          var database = new Database(nativeDatabase);
          return fetchAllRecords(database, objectStores).then((function(records) {
            database.close();
            return records;
          }));
        })).catch((function(error) {
          if (openedDatabase) {
            openedDatabase.close();
          }
          throw error;
        }));
      }}, {});
  }());
  var $__default = RecordFetcher;
  function fetchAllRecords(database, objectStores) {
    var objectStoreNames = objectStores.map((function(descriptor) {
      return descriptor.objectStore;
    }));
    var transaction = database.startTransaction(objectStoreNames);
    return Promise.all(objectStores.map((function(descriptor) {
      return fetchRecords(transaction.getObjectStore(descriptor.objectStore), descriptor.preprocessor);
    }))).then((function(fetchedRecords) {
      var recordsMap = {};
      for (var i = 0; i < objectStores.length; i++) {
        recordsMap[objectStores[i].objectStore] = fetchedRecords[i];
      }
      return transaction.completionPromise.then((function() {
        return recordsMap;
      }));
    }));
  }
  function fetchRecords(objectStore, preprocessor) {
    return new Promise((function(resolve, reject) {
      var records = [];
      objectStore.openCursor(null, CursorDirection.NEXT, (function(cursor) {
        var primaryKey = cursor.primaryKey;
        if (primaryKey instanceof Object) {
          Object.freeze(primaryKey);
        }
        var preprocessedRecord = preprocessor(cursor.record, primaryKey);
        if (preprocessedRecord === UpgradedDatabaseSchema.DELETE_RECORD) {
          cursor.delete();
          cursor.continue();
          return ;
        } else if (preprocessedRecord !== UpgradedDatabaseSchema.SKIP_RECORD) {
          records.push({
            key: primaryKey,
            record: preprocessedRecord
          });
        } else {}
        cursor.continue();
      })).then((function() {
        return resolve(records);
      })).catch((function(error) {
        return reject(error);
      }));
    }));
  }
  function openConnection(request, objectStoreNames) {
    return new Promise((function(resolve, reject) {
      request.onsuccess = (function() {
        var database = request.result;
        var databaseObjectStores = Array.from(database.objectStoreNames);
        objectStoreNames.forEach((function(objectStoreName) {
          if (databaseObjectStores.indexOf(objectStoreName) === -1) {
            reject(new Error(("The database " + database.name + " does not contain ") + ("the " + objectStoreName + " object store")));
            database.close();
            return ;
          }
        }));
        resolve(database);
      });
      request.onupgradeneeded = (function() {
        request.transaction.abort();
        reject(new Error(("The database " + request.result.name + " does not exist")));
      });
      request.onerror = (function() {
        reject(request.error);
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
//# sourceURL=es6/migration/RecordFetcher.js
