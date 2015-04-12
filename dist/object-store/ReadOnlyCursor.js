define(["./CursorDirection"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var CursorDirection = $__0.default;
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
        return new Promise((function(resolve, reject) {
          $__2[FIELDS.request].onsuccess = (function() {
            resolve(new ($__2.constructor)($__2[FIELDS.request]));
          });
          $__2[FIELDS.request].onerror = (function() {
            return reject($__2[FIELDS.request].error);
          });
          $__2[FIELDS.request].result.advance(stepsCount);
          $__2[FIELDS.flags].hasAdvanced = true;
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
        return new Promise((function(resolve, reject) {
          $__2[FIELDS.request].onsuccess = (function() {
            resolve(new $__2.constructor($__2[FIELDS.request]));
          });
          $__2[FIELDS.request].onerror = (function() {
            return reject($__2[FIELDS.request].error);
          });
          $__2[FIELDS.request].result.continue(nextKey);
          $__2[FIELDS.flags].hasAdvanced = true;
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
