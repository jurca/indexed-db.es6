define(["../PromiseSync", "./ReadOnlyCursor"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var PromiseSync = $__0.default;
  var ReadOnlyCursor = $__2.default;
  var FIELDS = Object.freeze({cursor: Symbol("cursor")});
  var Cursor = (function($__super) {
    function Cursor(cursorRequest) {
      $traceurRuntime.superConstructor(Cursor).call(this, cursorRequest);
      this[FIELDS.cursor] = cursorRequest.result;
    }
    return ($traceurRuntime.createClass)(Cursor, {
      update: function(record) {
        var request = this[FIELDS.cursor].update(record);
        return PromiseSync.resolve(request);
      },
      delete: function() {
        var request = this[FIELDS.cursor].delete();
        return PromiseSync.resolve(request);
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
//# sourceURL=es6/object-store/Cursor.js
