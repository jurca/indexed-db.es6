define(["../PromiseSync", "./CursorDirection"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var PromiseSync = $__0.default;
  var CursorDirection = $__2.default;
  var FIELDS = Object.freeze({
    request: Symbol("request"),
    flags: Symbol("flags"),
    iterationCallback: Symbol("iterationCallback")
  });
  var ReadOnlyCursor = function() {
    function ReadOnlyCursor(cursorRequest, iterationCallback) {
      this[FIELDS.request] = cursorRequest;
      this[FIELDS.iterationCallback] = iterationCallback;
      this[FIELDS.flags] = {hasAdvanced: false};
      var cursor = cursorRequest.result;
      var direction;
      if (cursor.direction.substring(0, 4) === "next") {
        direction = CursorDirection.NEXT;
      } else {
        direction = CursorDirection.PREVIOUS;
      }
      this.direction = direction;
      this.unique = cursor.direction.indexOf("unique") > -1;
      this.key = cursor.key;
      this.primaryKey = cursor.primaryKey;
      if (this.constructor === ReadOnlyCursor) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyCursor, {
      get record() {
        var cursor = this[FIELDS.request].result;
        return cursor.value;
      },
      advance: function() {
        var recordCount = arguments[0] !== (void 0) ? arguments[0] : 1;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        var request = this[FIELDS.request];
        request.result.advance(recordCount);
        this[FIELDS.flags].hasAdvanced = true;
        this[FIELDS.iterationCallback]();
      },
      continue: function() {
        var nextKey = arguments[0];
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        var request = this[FIELDS.request];
        request.result.continue(nextKey);
        this[FIELDS.flags].hasAdvanced = true;
        this[FIELDS.iterationCallback]();
      }
    }, {});
  }();
  var $__default = ReadOnlyCursor;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/ReadOnlyCursor.js
