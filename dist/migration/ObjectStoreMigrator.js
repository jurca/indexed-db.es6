define([], function() {
  "use strict";
  var FIELDS = Object.freeze({
    database: Symbol("database"),
    objectStore: Symbol("objectStore"),
    schema: Symbol("schema")
  });
  var ObjectStoreMigrator = (function() {
    function ObjectStoreMigrator(database, nativeObjectStore, schema) {
      this[FIELDS.database] = database;
      this[FIELDS.objectStore] = nativeObjectStore;
      this[FIELDS.schema] = schema;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(ObjectStoreMigrator, {executeMigration: function() {
        var schema = this[FIELDS.schema];
        var objectStore = this[FIELDS.objectStore];
        if (!objectStore) {
          objectStore = this[FIELDS.database].createObjectStore(schema.name, {
            keyPath: schema.keyPath || null,
            autoIncrement: schema.autoIncrement
          });
        }
        var indexNames = Array.from(objectStore.indexNames);
        indexNames.forEach((function(indexName) {
          if (shouldDeleteIndex(objectStore, schema, indexName)) {
            objectStore.deleteIndex(indexName);
          }
        }));
        schema.indexes.forEach((function(indexSchema) {
          createIndex(objectStore, indexSchema);
        }));
      }}, {});
  }());
  var $__default = ObjectStoreMigrator;
  function shouldDeleteIndex(objectStore, schema, indexName) {
    var newIndexNames = schema.indexes.map((function(indexSchema) {
      return indexSchema.name;
    }));
    if (newIndexNames.indexOf(indexName) === -1) {
      return true;
    }
    var index = objectStore.index(indexName);
    var indexKeyPath = index.keyPath;
    if (indexKeyPath && (typeof indexKeyPath !== "string")) {
      indexKeyPath = Array.from(indexKeyPath);
    }
    var serializedIndexKeyPath = JSON.stringify(indexKeyPath);
    var indexSchema = schema.indexes.filter((function(indexSchema) {
      return indexSchema.name === index.name;
    }))[0];
    return (index.unique !== indexSchema.unique) || (index.multiEntry !== indexSchema.multiEntry) || (serializedIndexKeyPath !== JSON.stringify(indexSchema.keyPaths));
  }
  function createIndex(objectStore, indexSchema) {
    var indexNames = Array.from(objectStore.indexNames);
    if (indexNames.indexOf(indexSchema.name) !== -1) {
      return ;
    }
    objectStore.createIndex(indexSchema.name, indexSchema.keyPath, {
      unique: indexSchema.unique,
      multiEntry: indexSchema.multiEntry
    });
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/migration/ObjectStoreMigrator.js
