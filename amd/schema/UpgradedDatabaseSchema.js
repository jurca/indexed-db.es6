define(["./validation"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var $__1 = $__0,
      isVersionValid = $__1.isVersionValid,
      getDuplicitNames = $__1.getDuplicitNames;
  var SKIP_RECORD = Object.freeze({});
  var DELETE_RECORD = Object.freeze({});
  var UpgradedDatabaseSchema = (function() {
    function UpgradedDatabaseSchema(version, fetchBefore, objectStores) {
      var after = arguments[3] !== (void 0) ? arguments[3] : (function() {});
      if (!isVersionValid(version)) {
        throw new TypeError("The version must be a positive integer, " + (version + " provided"));
      }
      if (version < 2) {
        throw new Error("The upgraded database schema must have a version " + ("number greater than 1, " + version + " provided"));
      }
      var duplicitNames = getDuplicitNames(objectStores);
      if (duplicitNames.length) {
        throw new Error("The following object stores are defined multiple " + ("times: " + duplicitNames.join(", ")));
      }
      this.version = version;
      this.fetchBefore = fetchBefore || [];
      this.objectStores = objectStores;
      this.after = after || ((function() {}));
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(UpgradedDatabaseSchema, {}, {
      get SKIP_RECORD() {
        return SKIP_RECORD;
      },
      get DELETE_RECORD() {
        return DELETE_RECORD;
      }
    });
  }());
  var $__default = UpgradedDatabaseSchema;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/schema/UpgradedDatabaseSchema.js
