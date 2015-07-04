define([], function() {
  "use strict";
  var KeyRange = function() {
    function KeyRange() {
      throw new Error("The KeyRange class is static, no instances can be " + "created");
    }
    return ($traceurRuntime.createClass)(KeyRange, {}, {
      from: function() {
        for (var rangeSpec = [],
            $__1 = 0; $__1 < arguments.length; $__1++)
          rangeSpec[$__1] = arguments[$__1];
        var lowerOpenSpecified = true;
        var upperOpenSpecified = true;
        if (typeof rangeSpec[0] !== "boolean") {
          rangeSpec.unshift(false);
          lowerOpenSpecified = false;
        }
        if (typeof rangeSpec[rangeSpec.length - 1] !== "boolean") {
          rangeSpec.push(false);
          upperOpenSpecified = false;
        }
        if (rangeSpec.length !== 4) {
          throw new Error(("Invalid range array, " + rangeSpec + " was provided"));
        }
        for (var i = 1; i < 3; i++) {
          if (rangeSpec[i] === null) {
            rangeSpec[i] = undefined;
          }
        }
        if ((rangeSpec[1] === undefined) && !lowerOpenSpecified) {
          return KeyRange.upperBound(rangeSpec[2], rangeSpec[3]);
        }
        if ((rangeSpec[2] === undefined) && !upperOpenSpecified) {
          return KeyRange.lowerBound(rangeSpec[1], rangeSpec[0]);
        }
        if (rangeSpec.slice(1, 3).every(function(value) {
          return value === undefined;
        })) {
          throw new Error(("Invalid range array, " + rangeArray + " was provided"));
        }
        return KeyRange.bound(rangeSpec[1], rangeSpec[2], rangeSpec[0], rangeSpec[3]);
      },
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
  function range() {
    var $__2;
    for (var rangeSpec = [],
        $__1 = 0; $__1 < arguments.length; $__1++)
      rangeSpec[$__1] = arguments[$__1];
    return ($__2 = KeyRange).from.apply($__2, $traceurRuntime.spread(rangeSpec));
  }
  return {
    get default() {
      return $__default;
    },
    get range() {
      return range;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/KeyRange.js
