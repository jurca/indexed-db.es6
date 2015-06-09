define([], function() {
  "use strict";
  var KeyRange = function() {
    function KeyRange() {
      throw new Error("The KeyRange class is static, no instances can be " + "created");
    }
    return ($traceurRuntime.createClass)(KeyRange, {}, {
      bound: function(lower, upper) {
        var lowerOpen = arguments[2] !== (void 0) ? arguments[2] : false;
        var upperOpen = arguments[3] !== (void 0) ? arguments[3] : false;
        return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
      },
      lowerBound: function(bound) {
        var open = arguments[1] !== (void 0) ? arguments[1] : false;
        return IDBKeyRange.lowerBound(bound, open);
      },
      upperBound: function(bound) {
        var open = arguments[1] !== (void 0) ? arguments[1] : false;
        return IDBKeyRange.upperBound(bound, open);
      },
      only: function(expectedValue) {
        return IDBKeyRange.only(expectedValue);
      }
    });
  }();
  var $__default = KeyRange;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/KeyRange.js
