define([], function() {
  "use strict";
  var CursorDirection = (function() {
    function CursorDirection(value) {
      this.value = value;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(CursorDirection, {}, {
      get NEXT() {
        return NEXT;
      },
      get PREVIOUS() {
        return PREVIOUS;
      }
    });
  }());
  var $__default = CursorDirection;
  var NEXT = new CursorDirection("NEXT");
  var PREVIOUS = new CursorDirection("PREVIOUS");
  Object.freeze(CursorDirection);
  return {
    get default() {
      return $__default;
    },
    get NEXT() {
      return NEXT;
    },
    get PREVIOUS() {
      return PREVIOUS;
    },
    __esModule: true
  };
});
//# sourceURL=src/object-store/CursorDirection.js
