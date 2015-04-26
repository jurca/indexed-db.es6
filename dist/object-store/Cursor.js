define(["./ReadOnlyCursor"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ReadOnlyCursor = $__0.default;
  var FIELDS = Object.freeze({cursor: Symbol("cursor")});
  var Cursor = (function($__super) {
    function Cursor(cursorRequest, requestMonitor) {
      $traceurRuntime.superConstructor(Cursor).call(this, cursorRequest, requestMonitor);
      this[FIELDS.cursor] = cursorRequest.result;
    }
    return ($traceurRuntime.createClass)(Cursor, {
      update: function(record) {
        var $__2 = this;
        return new Promise((function(resolve, reject) {
          var request = $__2[FIELDS.cursor].update(record);
          request.onsuccess = (function() {
            return resolve(request.result);
          });
          request.onerror = (function() {
            return reject();
          });
        }));
      },
      delete: function() {
        var $__2 = this;
        return new Promise((function(resolve, reject) {
          var request = $__2[FIELDS.cursor].delete();
          request.onsuccess = (function() {
            return resolve();
          });
          request.onerror = (function() {
            return reject();
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
