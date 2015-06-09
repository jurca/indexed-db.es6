define(["../PromiseSync", "../object-store/CursorDirection", "../schema/UpgradedDatabaseSchema", "../transaction/Transaction"], function($__0,$__2,$__4,$__6) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var PromiseSync = $__0.default;
  var CursorDirection = $__2.default;
  var UpgradedDatabaseSchema = $__4.default;
  var Transaction = $__6.default;
  var RecordFetcher = function() {
    function RecordFetcher() {}
    return ($traceurRuntime.createClass)(RecordFetcher, {fetchRecords: function(nativeTransaction, objectStores) {
        if (!objectStores.length) {
          throw new Error("The object stores array cannot be empty");
        }
        var transaction = new Transaction(nativeTransaction, function() {
          return transaction;
        });
        return fetchAllRecords(transaction, objectStores);
      }}, {});
  }();
  var $__default = RecordFetcher;
  function fetchAllRecords(transaction, objectStores) {
    return PromiseSync.all(objectStores.map(function(descriptor) {
      return fetchRecords(transaction.getObjectStore(descriptor.objectStore), descriptor.preprocessor);
    })).then(function(fetchedRecords) {
      var recordsMap = {};
      for (var i = 0; i < objectStores.length; i++) {
        recordsMap[objectStores[i].objectStore] = fetchedRecords[i];
      }
      return recordsMap;
    });
  }
  function fetchRecords(objectStore, preprocessor) {
    return new PromiseSync(function(resolve, reject) {
      var records = [];
      objectStore.openCursor(null, CursorDirection.NEXT, function(cursor) {
        var primaryKey = cursor.primaryKey;
        if (primaryKey instanceof Object) {
          Object.freeze(primaryKey);
        }
        var preprocessedRecord = preprocessor(cursor.record, primaryKey);
        if (preprocessedRecord === UpgradedDatabaseSchema.DELETE_RECORD) {
          cursor.delete();
          cursor.continue();
          return;
        } else if (preprocessedRecord !== UpgradedDatabaseSchema.SKIP_RECORD) {
          records.push({
            key: primaryKey,
            record: preprocessedRecord
          });
        } else {}
        cursor.continue();
      }).then(function() {
        return resolve(records);
      }).catch(function(error) {
        return reject(error);
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
//# sourceURL=es6/migration/RecordFetcher.js
