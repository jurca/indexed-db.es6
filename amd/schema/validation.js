define([], function() {
  "use strict";
  function isVersionValid(version) {
    return (parseInt(("" + version), 10) === version) && (version >= 1);
  }
  function getDuplicateNames(schemas) {
    var nameOccurrences = new Map();
    schemas.forEach(function(schema) {
      var count = (nameOccurrences.get(schema.name) || 0) + 1;
      nameOccurrences.set(schema.name, count);
    });
    var duplicateNames = [];
    schemas.forEach(function(count, schemaName) {
      if (count > 1) {
        duplicateNames.push(schemaName);
      }
    });
    return duplicateNames;
  }
  return {
    get isVersionValid() {
      return isVersionValid;
    },
    get getDuplicateNames() {
      return getDuplicateNames;
    },
    __esModule: true
  };
});
//# sourceURL=es6/schema/validation.js
