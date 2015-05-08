define(["../PromiseSync", "./AbstractReadOnlyStorage", "./CursorDirection", "./ReadOnlyCursor"], function($__0,$__2,$__4,$__6) {
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
  var AbstractReadOnlyStorage = $__2.default;
  var CursorDirection = $__4.default;
  var ReadOnlyCursor = $__6.default;
  var CURSOR_DIRECTIONS = [CursorDirection.NEXT, CursorDirection.PREVIOUS, "NEXT", "PREVIOUS", "PREV"];
  var FIELDS = Object.freeze({
    storage: Symbol("storage"),
    cursorConstructor: Symbol("cursorConstructor")
  });
  var ReadOnlyIndex = (function($__super) {
    function ReadOnlyIndex(storage, cursorConstructor, transactionFactory) {
      var storageFactory = (function() {
        var transaction = transactionFactory();
        var objectStore = transaction.getObjectStore(storage.objectStore.name);
        return objectStore.index(storage.name);
      });
      $traceurRuntime.superConstructor(ReadOnlyIndex).call(this, storage, cursorConstructor, storageFactory);
      this.multiEntry = storage.multiEntry;
      this.unique = storage.unique;
      this[FIELDS.storage] = storage;
      this[FIELDS.cursorConstructor] = cursorConstructor;
      if (this.constructor === ReadOnlyIndex) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyIndex, {
      getPrimaryKey: function(key) {
        var request = this[FIELDS.storage].getKey(key);
        return PromiseSync.resolve(request);
      },
      getAllPrimaryKeys: function() {
        var $__8 = this;
        var primaryKeys = [];
        return new PromiseSync((function(resolve, reject) {
          $__8.openKeyCursor().then(iterate).catch(reject);
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
        if (keyRange === null) {
          keyRange = undefined;
        }
        var cursorConstructor = this[FIELDS.cursorConstructor];
        if (typeof direction === "string") {
          if (CURSOR_DIRECTIONS.indexOf(direction.toUpperCase()) === -1) {
            throw new Error("When using a string as cursor direction, use NEXT " + ("or PREVIOUS, " + direction + " provided"));
          }
        } else {
          direction = direction.value;
        }
        var cursorDirection = direction.toLowerCase().substring(0, 4);
        if (unique) {
          cursorDirection += "unique";
        }
        var request = this[FIELDS.storage].openCursor(keyRange, cursorDirection);
        return PromiseSync.resolve(request).then((function() {
          return new cursorConstructor(request);
        }));
      },
      openKeyCursor: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var unique = arguments[2] !== (void 0) ? arguments[2] : false;
        if (keyRange === null) {
          keyRange = undefined;
        }
        if (typeof direction === "string") {
          if (CURSOR_DIRECTIONS.indexOf(direction.toUpperCase()) === -1) {
            throw new Error("When using a string as cursor direction, use NEXT " + ("or PREVIOUS, " + direction + " provided"));
          }
        } else {
          direction = direction.value;
        }
        var cursorDirection = direction.toLowerCase().substring(0, 4);
        if (unique) {
          cursorDirection += "unique";
        }
        var request = this[FIELDS.storage].openKeyCursor(keyRange, cursorDirection);
        return PromiseSync.resolve(request).then((function() {
          return new ReadOnlyCursor(request);
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
//# sourceURL=es6/object-store/ReadOnlyIndex.js
