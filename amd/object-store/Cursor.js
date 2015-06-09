define(["../PromiseSync", "./ReadOnlyCursor"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var PromiseSync = $__0.default;
  var ReadOnlyCursor = $__2.default;
  var FIELDS = Object.freeze({
    cursor: Symbol("cursor"),
    iterationCalback: Symbol("iterationCalback"),
    suboperationCallback: Symbol("suboperationCallback"),
    suboperationPromise: Symbol("suboperationPromise"),
    flags: Symbol("flags")
  });
  var Cursor = function($__super) {
    function Cursor(cursorRequest, iterationCalback, suboperationCallback) {
      $traceurRuntime.superConstructor(Cursor).call(this, cursorRequest, function() {});
      this[FIELDS.cursor] = cursorRequest.result;
      this[FIELDS.iterationCalback] = iterationCalback;
      this[FIELDS.suboperationCallback] = suboperationCallback;
      this[FIELDS.suboperationPromise] = PromiseSync.resolve();
      this[FIELDS.flags] = {hasAdvanced: false};
    }
    return ($traceurRuntime.createClass)(Cursor, {
      update: function(record) {
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        var request = this[FIELDS.cursor].update(record);
        var operationPromise = this[FIELDS.suboperationCallback](request);
        this[FIELDS.suboperationPromise] = this[FIELDS.suboperationPromise].then(function() {
          return operationPromise;
        });
        return operationPromise;
      },
      delete: function() {
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        var request = this[FIELDS.cursor].delete();
        var operationPromise = this[FIELDS.suboperationCallback](request);
        this[FIELDS.suboperationPromise] = this[FIELDS.suboperationPromise].then(function() {
          return operationPromise;
        });
        return operationPromise;
      },
      advance: function() {
        var recordCount = arguments[0] !== (void 0) ? arguments[0] : 1;
        var $__4 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        this[FIELDS.flags].hasAdvanced = true;
        this[FIELDS.suboperationPromise].then(function() {
          return $traceurRuntime.superGet($__4, Cursor.prototype, "advance").call($__4, recordCount);
        });
        this[FIELDS.iterationCalback]();
      },
      continue: function() {
        var nextKey = arguments[0];
        var $__4 = this;
        if (this[FIELDS.flags].hasAdvanced) {
          throw new Error("This cursor instance has already advanced to another " + "record");
        }
        this[FIELDS.flags].hasAdvanced = true;
        this[FIELDS.suboperationPromise].then(function() {
          return $traceurRuntime.superGet($__4, Cursor.prototype, "continue").call($__4, nextKey);
        });
        this[FIELDS.iterationCalback]();
      }
    }, {}, $__super);
  }(ReadOnlyCursor);
  var $__default = Cursor;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/Cursor.js
