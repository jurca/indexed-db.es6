define(["./AbstractReadOnlyStorage", "./CursorDirection", "./ReadOnlyCursor"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var AbstractReadOnlyStorage = $__0.default;
  var CursorDirection = $__2.default;
  var ReadOnlyCursor = $__4.default;
  var FIELDS = Object.freeze({
    storage: Symbol("storage"),
    cursorConstructor: Symbol("cursorConstructor"),
    requestMonitor: Symbol("requestMonitor")
  });
  var ReadOnlyIndex = (function($__super) {
    function ReadOnlyIndex(storage, cursorConstructor, requestMonitor, transactionFactory) {
      var storageFactory = (function() {
        var transaction = transactionFactory();
        var objectStore = transaction.getObjectStore(storage.objectStore.name);
        return objectStore.index(storage.name);
      });
      $traceurRuntime.superConstructor(ReadOnlyIndex).call(this, storage, cursorConstructor, requestMonitor, storageFactory);
      this.multiEntry = storage.multiEntry;
      this.unique = storage.unique;
      this[FIELDS.storage] = storage;
      this[FIELDS.cursorConstructor] = cursorConstructor;
      this[FIELDS.requestMonitor] = requestMonitor;
      if (this.constructor === ReadOnlyIndex) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyIndex, {
      getPrimaryKey: function(key) {
        var $__6 = this;
        return new Promise((function(resolve, reject) {
          var request = $__6[FIELDS.storage].getKey(key);
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return reject(request.error);
          });
        }));
      },
      getAllPrimaryKeys: function() {
        var $__6 = this;
        var primaryKeys = [];
        return new Promise((function(resolve, reject) {
          $__6.openKeyCursor().then(iterate).catch(reject);
          function iterate(cursor) {
            if (cursor.done) {
              resolve(primaryKeys);
              return ;
            }
            primaryKeys.push(cursor.primaryKey);
            cursor.advance().then(iterate).catch(reject);
          }
        }));
      },
      openCursor: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var unique = arguments[2] !== (void 0) ? arguments[2] : false;
        var $__6 = this;
        if (keyRange === null) {
          keyRange = undefined;
        }
        var cursorConstructor = this[FIELDS.cursorConstructor];
        if (typeof direction === "string") {
          if (["NEXT", "PREVIOUS"].indexOf(direction.toUpperCase()) === -1) {
            throw new Error("When using a string as cursor direction, use NEXT " + ("or PREVIOUS, " + direction + " provided"));
          }
          direction = CursorDirection[direction.toUpperCase()];
        }
        var cursorDirection = direction.value.toLowerCase().substring(0, 4);
        if (unique) {
          cursorDirection += "unique";
        }
        var request = this[FIELDS.storage].openCursor(keyRange, cursorDirection);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            resolve(new cursorConstructor(request, $__6[FIELDS.requestMonitor]));
          });
          request.onerror = (function() {
            return reject(request.error);
          });
        }));
      },
      openKeyCursor: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var unique = arguments[2] !== (void 0) ? arguments[2] : false;
        var $__6 = this;
        if (keyRange === null) {
          keyRange = undefined;
        }
        if (typeof direction === "string") {
          if (["NEXT", "PREVIOUS"].indexOf(direction.toUpperCase()) === -1) {
            throw new Error("When using a string as cursor direction, use NEXT " + ("or PREVIOUS, " + direction + " provided"));
          }
          direction = CursorDirection[direction.toUpperCase()];
        }
        var cursorDirection = direction.value.toLowerCase().substring(0, 4);
        if (unique) {
          cursorDirection += "unique";
        }
        var request = this[FIELDS.storage].openKeyCursor(keyRange, cursorDirection);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            resolve(new ReadOnlyCursor(request, $__6[FIELDS.requestMonitor]));
          });
          request.onerror = (function() {
            return reject(request.error);
          });
        }));
      }
    }, {}, $__super);
  }(AbstractReadOnlyStorage));
  var $__default = ReadOnlyIndex;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/ReadOnlyIndex.js
