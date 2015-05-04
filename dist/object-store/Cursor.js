define(["./ReadOnlyCursor"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ReadOnlyCursor = $__0.default;
  var FIELDS = Object.freeze({cursor: Symbol("cursor")});
  var Cursor = (function($__super) {
    function Cursor(cursorRequest) {
      $traceurRuntime.superConstructor(Cursor).call(this, cursorRequest);
      this[FIELDS.cursor] = cursorRequest.result;
    }
    return ($traceurRuntime.createClass)(Cursor, {
      update: function(record) {
        var request = this[FIELDS.cursor].update(record);
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return resolve(request.error);
          });
        }));
      },
      delete: function() {
        var request = this[FIELDS.cursor].delete();
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return resolve(request.error);
          });
        }));
      }
    }, {}, $__super);
  }(ReadOnlyCursor));
  var $__default = Cursor;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/Cursor.js
