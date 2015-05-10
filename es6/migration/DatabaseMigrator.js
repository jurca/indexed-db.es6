
import PromiseSync from "../PromiseSync"
import RecordFetcher from "./RecordFetcher"
import DatabaseVersionMigrator from "./DatabaseVersionMigrator"
import DatabaseSchema from "../schema/DatabaseSchema"
import UpgradedDatabaseSchema from "../schema/UpgradedDatabaseSchema"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  database: Symbol("database"),
  transaction: Symbol("transaction"),
  schemaDescriptors: Symbol("schemaDescriptors"),
  currentVersion: Symbol("currentVersion")
})

/**
 * Database migrator evaluates the provided database schemas to upgrade the
 * database to the greatest described version.
 */
export default class DatabaseMigrator {
  /**
   * Initializes the database migrator.
   *
   * @param {IDBDatabase} database The native Indexed DB database to upgrade.
   * @param {IDBTransaction} transaction The native {@code versionchange}
   *        transaction to use to manipulate the data.
   * @param {((DatabaseSchema|UpgradedDatabaseSchema)[]|Object[])}
   *        schemaDescriptors Descriptors of the database schema for all known
   *        database versions.
   * @param {number} currentVersion The current version of the database, as a
   *        positive integer, or set to {@code 0} if the database is being
   *        created.
   */
  constructor(database, transaction, schemaDescriptors, currentVersion) {
    if (!schemaDescriptors.length) {
      throw new Error("The list of schema descriptors cannot be empty")
    }
    let sortedSchemasCopy = schemaDescriptors.slice().sort((desc1, desc2) => {
      return desc1.version - desc2.version
    })
    checkSchemaDescriptorTypes(sortedSchemasCopy)
    
    let isVersionValid = (currentVersion >= 0) &&
        (parseInt(currentVersion, 10) === currentVersion)
    if (!isVersionValid) {
      throw new Error("The version number must be either a positive " +
          "integer, or 0 if the database is being created")
    }

    /**
     * The native Indexed DB database connection.
     *
     * @type {IDBDatabase}
     */
    this[FIELDS.database] = database
    
    /**
     * The native {@code versionchange} transaction to use to manipulate the
     * data.
     * 
     * @type {IDBTransaction}
     */
    this[FIELDS.transaction] = transaction

    /**
     * Descriptors of the database schemas across the versions of the database,
     * sorting by the database version in ascending order.
     *
     * The first element is always a {@codelink DatabaseSchema} instance, the
     * rest of the elements are instances of the
     * {@codelink UpgradedDatabaseSchema} classes.
     *
     * @type {(DatabaseSchema|UpgradedDatabaseSchema)[]}
     */
    this[FIELDS.schemaDescriptors] = Object.freeze(sortedSchemasCopy)
    
    /**
     * The current version of the database, before the migration was started.
     * The version number is either a positive integer, or {@code 0} if the
     * database is being created.
     *
     * @type {number}
     */
    this[FIELDS.currentVersion] = currentVersion

    Object.freeze(this)
  }

  /**
   * Processes the schema descriptors and upgrades the database to the greatest
   * described version.
   * 
   * @return {PromiseSync<undefined>} A promise that resolves when the schema is
   *         upgraded to the greatest version specified in the schema
   *         descriptors.
   */
  executeMigration() {
    return migrateDatabase(
      this[FIELDS.database],
      this[FIELDS.transaction],
      this[FIELDS.schemaDescriptors],
      this[FIELDS.currentVersion]
    )
  }
}

/**
 * Processes the schema descriptors to upgrade the database schema to the
 * greatest version specified.
 * 
 * @param {string} databaseName The name of the Indexed DB database to migrate.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)[]} schemaDescriptors Schema
 *        descriptors of the database schemas for various versions, sorted in
 *        ascending order by the version number.
 * @param {number} currentVersion The current version of the database schema.
 * @return {PromiseSync<undefined>} A promise that resolves when the schema is
 *         upgraded to the greatest version specified in the schema
 *         descriptors.
 */
function migrateDatabase(nativeDatabase, nativeTransaction, schemaDescriptors,
    currentVersion) {
  let descriptorsToProcess = schemaDescriptors.filter((descriptor) => {
    return descriptor.version > currentVersion
  })
  
  if (!descriptorsToProcess.length) {
    return PromiseSync.resolve(undefined)
  }
  
  return migrateDatabaseVersion(
    nativeDatabase,
    nativeTransaction,
    descriptorsToProcess[0]
  ).then(() => {
    return migrateDatabase(
      nativeDatabase,
      nativeTransaction,
      descriptorsToProcess,
      descriptorsToProcess[0].version
    )
  })
}

/**
 * Performs a single-version database migration to the schema described by the
 * provided database schema descriptor.
 *
 * @param {IDBDatabase} nativeDatabase The native Indexed DB database being
 *        migrated to a higher version.
 * @param {IDBTransaction} nativeTransaction The native Indexed DB
 *        {@code versionchange} transaction to use to manipulate the data.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)} descriptor Schema
 *        descriptor of the version to which the database is to be upgraded.
 * @return {PromiseSync<undefined>} A promise that resolves once the database
 *         has been upgraded to the schema described by the provided schema
 *         descriptor.
 */
function migrateDatabaseVersion(nativeDatabase, nativeTransaction,
    descriptor) {
  let fetchPromise
  if (descriptor.fetchBefore && descriptor.fetchBefore.length) {
    let fetcher = new RecordFetcher()
    let objectStores = normalizeFetchBeforeObjectStores(descriptor.fetchBefore)
    fetchPromise = fetcher.fetchRecords(nativeTransaction, objectStores)
  } else {
    fetchPromise = PromiseSync.resolve({})
  }
  
  return fetchPromise.then((recordsMap) => {
    let versionMigrator = new DatabaseVersionMigrator(
      nativeDatabase,
      nativeTransaction,
      descriptor.objectStores
    )
    
    return versionMigrator.executeMigration(
      descriptor.after || (() => {}),
      recordsMap
    )
  })
}

/**
 * Normalizes the provided array of object store fetch descriptors to process
 * before upgrading the database schema.
 * 
 * @param {(string|{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)=})[]}
 *        objectStores The names of object stores that should have their
 *        records fetch or (possibley partially filled) object store fetch
 *        descriptors, mixed in an array.
 * @return {{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)}[]}
 *         Normalized object store fetch descriptors.
 */
function normalizeFetchBeforeObjectStores(objectStores) {
  return objectStores.map((objectStore) => {
    if (typeof objectStore === "string") {
      return {
        objectStore,
        preprocessor: record => record
      }
    } else if (!objectStore.preprocessor) {
      return {
        objectStore: objectStore.objectStore,
        preprocessor: record => record
      }
    } else {
      return objectStore
    }
  })
}

/**
 * Validates the types of the provided schema descriptors.
 * 
 * @param {((DatabaseSchema|UpgradedDatabaseSchema)[]|Object[])}
 *        schemaDescriptors The database schemas for database versions to
 *        validate, sorted by version number in the ascending order.
 * @throws {TypeError} Thrown if the schema descriptors are of invalid type.
 */
function checkSchemaDescriptorTypes(schemaDescriptors) {
  let onlyPlainObjects = schemaDescriptors.every((descriptor) => {
    return descriptor.constructor === Object
  })
  if (onlyPlainObjects) {
    return
  }
  
  if (!(schemaDescriptors[0] instanceof DatabaseSchema)) {
    throw new TypeError("The schema descriptor of the lowest described " +
        `database version (${schemaDescriptors[0].version}) must be a ` +
        "DatabaseSchema instance, or all schema descriptors must be plain " +
        "objects")
  }
  schemaDescriptors.slice(1).forEach((descriptor) => {
    if (!(descriptor instanceof UpgradedDatabaseSchema)) {
      throw new TypeError("The schema descriptors of the upgraded database " +
          "versions must be UpgradedDatabaseSchema instances, but the " +
          `provided descriptor of version ${descriptor.version} was not an ` +
          "UpgradedDatabaseSchema instance, or all schema descriptors must " +
          "be plain objects")
    }
  })
}
