define([], function() {
  "use strict";
  var IndexSchema = function() {
    function IndexSchema(indexName, keyPath) {
      var unique = arguments[2] !== (void 0) ? arguments[2] : false;
      var multiEntry = arguments[3] !== (void 0) ? arguments[3] : false;
      this.name = indexName;
      this.keyPath = keyPath;
      this.unique = unique;
      this.multiEntry = multiEntry;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(IndexSchema, {}, {});
  }();
  var $__default = IndexSchema;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/schema/IndexSchema.js
