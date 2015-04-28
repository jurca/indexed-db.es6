define(["./CursorDirection"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var CursorDirection = $__0.default;
  var FIELDS = Object.freeze({
    request: Symbol("request"),
    flags: Symbol("flags"),
    requestMonitor: Symbol("requestMonitor")
  });
  var ReadOnlyCursor = (function() {
    function ReadOnlyCursor(cursorRequest, requestMonitor) {
      this[FIELDS.request] = cursorRequest;
      this[FIELDS.requestMonitor] = requestMonitor;
      this[FIELDS.flags] = {hasAdvanced: false};
      var cursor = cursorRequest.result;
      var direction;
      if (!cursor) {
        direction = null;
      } else if (cursor.direction.substring(0, 4) === "next") {
        direction = CursorDirection.NEXT;
      } else {
        direction = CursorDirection.PREVIOUS;
      }
      this.done = !cursor;
      this.direction = direction;
      this.unique = cursor ? (cursor.direction.indexOf("unique") > -1) : null;
      this.key = cursor ? cursor.key : null;
      this.primaryKey = cursor ? cursor.primaryKey : null;
      this.record = cursor ? (cursor.value || null) : null;
      if (this.constructor === ReadOnlyCursor) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyCursor, {
      advance: function() {
        var stepsCount = arguments[0] !== (void 0) ? arguments[0] : 1;
        var $__2 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record, use the new returned cursor");
        }
        if (this.done) {
          throw new Error("The cursor has already reached the end of the " + "records sequence");
        }
        var request = this[FIELDS.request];
        request.result.advance(stepsCount);
        this[FIELDS.flags].hasAdvanced = true;
        return this[FIELDS.requestMonitor].monitor(request).then((function() {
          return new ($__2.constructor)(request, $__2[FIELDS.requestMonitor]);
        }));
      },
      continue: function() {
        var nextKey = arguments[0];
        var $__2 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance");
        }
        if (this.done) {
          throw new Error("The cursor has already reached the end of the " + "records sequence");
        }
        var request = this[FIELDS.request];
        request.result.continue(nextKey);
        this[FIELDS.flags].hasAdvanced = true;
        return this[FIELDS.requestMonitor].monitor(request).then((function() {
          return new $__2.constructor(request, $__2[FIELDS.requestMonitor]);
        }));
      }
    }, {});
  }());
  var $__default = ReadOnlyCursor;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/ReadOnlyCursor.js
