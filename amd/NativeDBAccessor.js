define([], function() {
  "use strict";
  var nativeIndexedDB = typeof indexedDB !== "undefined" ? indexedDB : null;
  var NativeDBAccessor = function() {
    function NativeDBAccessor() {
      throw new Error("The native DB accessor class is static");
    }
    return ($traceurRuntime.createClass)(NativeDBAccessor, {}, {
      get indexedDB() {
        return nativeIndexedDB;
      },
      set indexedDB(newIndexedDBImplementation) {
        nativeIndexedDB = newIndexedDBImplementation;
      }
    });
  }();
  var $__default = NativeDBAccessor;
  function idbProvider() {
    return NativeDBAccessor.indexedDB;
  }
  return {
    get default() {
      return $__default;
    },
    get idbProvider() {
      return idbProvider;
    },
    __esModule: true
  };
});
//# sourceURL=es6/NativeDBAccessor.js
