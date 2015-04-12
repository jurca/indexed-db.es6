define(["./validation"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var $__1 = $__0,
      isVersionValid = $__1.isVersionValid,
      getDuplicitNames = $__1.getDuplicitNames;
  var DatabaseSchema = (function() {
    function DatabaseSchema(version) {
      for (var objectStores = [],
          $__3 = 1; $__3 < arguments.length; $__3++)
        objectStores[$__3 - 1] = arguments[$__3];
      if (!isVersionValid(version)) {
        throw new TypeError("The version must be a positive integer, " + (version + " provided"));
      }
      var duplicitNames = getDuplicitNames(objectStores);
      if (duplicitNames.length) {
        throw new Error("The following object stores are defined multiple " + ("times: " + duplicitNames.join(", ")));
      }
      this.version = version;
      this.objectStores = objectStores;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(DatabaseSchema, {}, {});
  }());
  var $__default = DatabaseSchema;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/schema/DatabaseSchema.js
