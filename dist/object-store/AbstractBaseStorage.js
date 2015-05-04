define(["./CursorDirection"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var CursorDirection = $__0.default;
  var FIELDS = Object.freeze({
    storage: Symbol("storage"),
    cursorConstructor: Symbol("cursorConstructor")
  });
  var AbstractBaseStorage = (function() {
    function AbstractBaseStorage(storage, cursorConstructor) {
      if (this.constructor === AbstractBaseStorage) {
        throw new Error("THe AbstractBaseStorage class is abstract and must " + "be overridden");
      }
      var keyPath = storage.keyPath;
      if (keyPath && (typeof keyPath !== "string")) {
        keyPath = Array.from(keyPath);
      }
      this.keyPath = keyPath || null;
      this.name = storage.name;
      this[FIELDS.storage] = storage;
      this[FIELDS.cursorConstructor] = cursorConstructor;
    }
    return ($traceurRuntime.createClass)(AbstractBaseStorage, {
      get: function(key) {
        var isCompoundKeyObject = (key instanceof Object) && !(key instanceof IDBKeyRange);
        if (isCompoundKeyObject) {
          if (!(this.keyPath instanceof Array)) {
            throw new Error("This storage does not use a compound key, but one " + "was provided");
          }
          key = normalizeCompoundObjectKey(this.keyPath, key);
        }
        var request = this[FIELDS.storage].get(key);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return resolve(request.error);
          });
        }));
      },
      openCursor: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
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
        var request = this[FIELDS.storage].openCursor(keyRange, cursorDirection);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return resolve(request.error);
          });
        })).then((function() {
          return new cursorConstructor(request);
        }));
      }
    }, {});
  }());
  var $__default = AbstractBaseStorage;
  function normalizeCompoundObjectKey(keyPaths, key) {
    var normalizedKey = [];
    keyPaths.forEach((function(keyPath) {
      var keyValue = key;
      keyPath.split(".").forEach((function(fieldName) {
        if (!keyValue.hasOwnProperty(fieldName)) {
          throw new Error(("The " + keyPath + " key path is not defined in the ") + "provided compound key");
        }
        keyValue = keyValue[fieldName];
      }));
      normalizedKey.push(keyValue);
    }));
    return normalizedKey;
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/AbstractBaseStorage.js
