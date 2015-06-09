define(["./IndexSchema", "./validation"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var IndexSchema = $__0.default;
  var getDuplicitNames = $__2.getDuplicitNames;
  var ObjectStoreSchema = function() {
    function ObjectStoreSchema(storeName) {
      var keyPath = arguments[1] !== (void 0) ? arguments[1] : "";
      var autoIncrement = arguments[2] !== (void 0) ? arguments[2] : false;
      for (var indexes = [],
          $__5 = 3; $__5 < arguments.length; $__5++)
        indexes[$__5 - 3] = arguments[$__5];
      var duplicitNames = getDuplicitNames(indexes);
      if (duplicitNames.length) {
        throw new Error("The following indexes are defined multiple times:" + duplicitNames.join(", "));
      }
      this.name = storeName;
      this.keyPath = keyPath;
      this.autoIncrement = autoIncrement;
      this.indexes = indexes;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(ObjectStoreSchema, {}, {});
  }();
  var $__default = ObjectStoreSchema;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/schema/ObjectStoreSchema.js
