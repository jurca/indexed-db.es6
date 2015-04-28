define(["./ReadOnlyCursor"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ReadOnlyCursor = $__0.default;
  var FIELDS = Object.freeze({
    cursor: Symbol("cursor"),
    requestMonitor: Symbol("requestMonitor")
  });
  var Cursor = (function($__super) {
    function Cursor(cursorRequest, requestMonitor) {
      $traceurRuntime.superConstructor(Cursor).call(this, cursorRequest, requestMonitor);
      this[FIELDS.cursor] = cursorRequest.result;
      this[FIELDS.requestMonitor] = requestMonitor;
    }
    return ($traceurRuntime.createClass)(Cursor, {
      update: function(record) {
        var request = this[FIELDS.cursor].update(record);
        return this[FIELDS.requestMonitor].monitor(request);
      },
      delete: function() {
        return this[FIELDS.requestMonitor].monitor(this[FIELDS.cursor].delete());
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
