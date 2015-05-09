define(["./ReadOnlyIndex", "./Cursor", "./CursorDirection"], function($__0,$__2,$__4) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var ReadOnlyIndex = $__0.default;
  var Cursor = $__2.default;
  var CursorDirection = $__4.default;
  var Index = (function($__super) {
    function Index(storage, transactionFactory) {
      var storageFactory = (function() {
        var transaction = transactionFactory();
        var objectStore = transaction.getObjectStore(storage.objectStore.name);
        return objectStore.index(storage.name);
      });
      $traceurRuntime.superConstructor(Index).call(this, storage, Cursor, storageFactory);
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(Index, {
      openCursor: function(keyRange, direction, unique, recordCallback) {
        return $traceurRuntime.superGet(this, Index.prototype, "openCursor").call(this, keyRange, direction, unique, recordCallback);
      },
      createCursorFactory: function() {
        var keyRange = arguments[0];
        var direction = arguments[1] !== (void 0) ? arguments[1] : CursorDirection.NEXT;
        var unique = arguments[2] !== (void 0) ? arguments[2] : false;
        return $traceurRuntime.superGet(this, Index.prototype, "createCursorFactory").call(this, keyRange, direction, unique);
      }
    }, {}, $__super);
  }(ReadOnlyIndex));
  var $__default = Index;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/Index.js
