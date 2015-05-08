define([], function() {
  "use strict";
  function isVersionValid(version) {
    return (parseInt(("" + version), 10) === version) && (version >= 1);
  }
  function getDuplicitNames(schemas) {
    var nameOccurrences = new Map();
    schemas.forEach((function(schema) {
      var count = (nameOccurrences.get(schema.name) || 0) + 1;
      nameOccurrences.set(schema.name, count);
    }));
    var duplicitNames = [];
    schemas.forEach((function(count, schemaName) {
      if (count > 1) {
        duplicitNames.push(schemaName);
      }
    }));
    return duplicitNames;
  }
  return {
    get isVersionValid() {
      return isVersionValid;
    },
    get getDuplicitNames() {
      return getDuplicitNames;
    },
    __esModule: true
  };
});
//# sourceURL=es6/schema/validation.js
