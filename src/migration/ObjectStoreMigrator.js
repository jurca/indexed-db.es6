
/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  database: Symbol("database"),
  objectStore: Symbol("objectStore"),
  schema: Symbol("schema")
})

/**
 * Migrator of object store schemas.
 */
export default class ObjectStoreMigrator {
  /**
   * Initializes the object store migrator.
   *
   * @param {IDBDatabase} database The native Indexed DB database being
   *        migrated.
   * @param {?IDBObjectStore} nativeObjectStore The native Indexed DB object
   *        store being migrated. Set to {@code null} if the object store does
   *        not exist yet.
   * @param {ObjectStoreSchema} schema Schema descriptor of the version to
   *        which the database is to be upgraded.
   */
  constructor(database, nativeObjectStore, schema) {
    /**
     * The native Indexed DB database being migrated.
     *
     * @type {IDBDatabase}
     */
    this[FIELDS.database] = database

    /**
     * The native Indexed DB object store being migrated, or {@code null} if
     * the object store does not exist yet.
     *
     * @type {?IDBObjectStore}
     */
    this[FIELDS.objectStore] = nativeObjectStore

    /**
     * The schema to which the object store should be migrated.
     *
     * @type {ObjectStoreSchema}
     */
    this[FIELDS.schema] = schema

    Object.freeze(this)
  }

  /**
   * Processes the schema descriptor and migrates the object store. The object
   * store will be created if it does not already exist.
   */
  executeMigration() {
    let schema = this[FIELDS.schema]
    let objectStore = this[FIELDS.objectStore]
    if (!objectStore) {
      objectStore = this[FIELDS.database].createObjectStore(schema.name, {
        keyPath: schema.keyPath || null,
        autoIncrement: schema.autoIncrement
      })
    }

    let indexNames = Array.from(objectStore.indexNames)
    indexNames.forEach((indexName) => {
      if (shouldDeleteIndex(objectStore, schema, indexName)) {
        objectStore.deleteIndex(indexName)
      }
    })

    schema.indexes.forEach((indexSchema) => {
      createIndex(objectStore, indexSchema)
    })
  }
}

/**
 * Returns {@code true} if the index should be deleted from the object store,
 * whether because it is no longer present in the schema or its properties have
 * been updated in the schema.
 *
 * @param {IDBObjectStore} objectStore The native Indexed DB object store.
 * @param {ObjectStoreSchema} schema The schema of the object store.
 * @param {string} indexName The name of the index being tested whether it
 *        shold be deleted.
 * @return {@code true} if the index should be deleted.
 */
function shouldDeleteIndex(objectStore, schema, indexName) {
  let newIndexNames = schema.indexes.map(indexSchema => indexSchema.name)

  if (newIndexNames.indexOf(indexName) === -1) {
    return true
  }

  let index = objectStore.index(indexName)
  let indexKeyPath = index.keyPath;
  if (indexKeyPath && (typeof indexKeyPath !== "string")) {
    indexKeyPath = Array.from(indexKeyPath)
  }
  let serializedIndexKeyPath = JSON.stringify(indexKeyPath)

  let indexSchema = schema.indexes.filter((indexSchema) => {
    return indexSchema.name === index.name
  })[0]

  return (index.unique !== indexSchema.unique) ||
      (index.multiEntry !== indexSchema.multiEntry) ||
      (serializedIndexKeyPath !== JSON.stringify(indexSchema.keyPaths))
}

/**
 * Creates a new index in the provided object store according to the provided
 * index schema.
 *
 * @param {IDBObjectStore} objectStore The native Indexed DB object store.
 */
function createIndex(objectStore, indexSchema) {
  let indexNames = Array.from(objectStore.indexNames)

  if (indexNames.indexOf(indexSchema.name) !== -1) {
    return
  }

  objectStore.createIndex(indexSchema.name, indexSchema.keyPath, {
    unique: indexSchema.unique,
    multiEntry: indexSchema.multiEntry
  })
}
