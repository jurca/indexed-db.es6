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
    flags: Symbol("flags")
  });
  var ReadOnlyCursor = (function() {
    function ReadOnlyCursor(cursorRequest) {
      this[FIELDS.request] = cursorRequest;
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
      if (this.constructor === ReadOnlyCursor) {
        Object.freeze(this);
      }
    }
    return ($traceurRuntime.createClass)(ReadOnlyCursor, {
      get record() {
        var cursor = this[FIELDS.request].result;
        return cursor ? cursor.value : null;
      },
      advance: function() {
        var stepsCount = arguments[0] !== (void 0) ? arguments[0] : 1;
        var $__4 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record, use the new returned cursor");
        }
        if (this.done) {
          throw new Error("The cursor has already reached the end of the " + "records sequence");
        }
        var request = this[FIELDS.request];
        request.result.advance(stepsCount);
        this[FIELDS.flags].hasAdvanced = true;
        return PromiseSync.resolve(request).then((function() {
          return new ($__4.constructor)(request);
        }));
      },
      continue: function() {
        var nextKey = arguments[0];
        var $__4 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance");
        }
        if (this.done) {
          throw new Error("The cursor has already reached the end of the " + "records sequence");
        }
        var request = this[FIELDS.request];
        request.result.continue(nextKey);
        this[FIELDS.flags].hasAdvanced = true;
        return PromiseSync.resolve(request).then((function() {
          return new $__4.constructor(request);
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
//# sourceURL=es6/object-store/ReadOnlyCursor.js