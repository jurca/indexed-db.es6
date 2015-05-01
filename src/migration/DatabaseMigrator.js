
import RecordFetcher from "./RecordFetcher"
import DatabaseVersionMigrator from "./DatabaseVersionMigrator"
import DatabaseSchema from "../schema/DatabaseSchema"
import UpgradedDatabaseSchema from "../schema/UpgradedDatabaseSchema"
import Transaction from "../transaction/Transaction"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  databaseName: Symbol("databaseName"),
  schemaDescriptors: Symbol("schemaDescriptors"),
  currentVersion: Symbol("currentVersion"),
  commitDelay: Symbol("commitDelay")
})

/**
 * Database migrator evaluates the provided database schemas to upgrade the
 * database to the greatest described version.
 */
export default class DatabaseMigrator {
  /**
   * Initializes the database migrator.
   *
   * @param {string} databaseName The name of the Indexed DB database to
   *        upgrade.
   * @param {((DatabaseSchema|UpgradedDatabaseSchema)[]|Object[])}
   *        schemaDescriptors Descriptors of the database schema for all known
   *        database versions.
   * @param {number} currentVersion The current version of the database, as a
   *        positive integer, or set to {@code 0} if the database is being
   *        created.
   * @param {number} commitDelay The delay in milliseconds how long the
   *        transaction should be kept alive if inactive.
   */
  constructor(databaseName, schemaDescriptors, currentVersion, commitDelay) {
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
     * @type {@IDBDatabase}
     */
    this[FIELDS.databaseName] = databaseName

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
    
    /**
     * Delay in milliseconds for how long an inactive transction should be
     * kept alive.
     * 
     * @type {number}
     */
    this[FIELDS.commitDelay] = commitDelay

    Object.freeze(this)
  }

  /**
   * Processes the schema descriptors and upgrades the database to the greatest
   * described version.
   * 
   * @return {Promise<undefined>} A promise that resolves when the schema is
   *         upgraded to the greatest version specified in the schema
   *         descriptors.
   */
  executeMigration() {
    return migrateDatabase(
      this[FIELDS.databaseName],
      this[FIELDS.schemaDescriptors],
      this[FIELDS.currentVersion],
      this[FIELDS.commitDelay]
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
 * @param {number} commitDelay Delay in milliseconds for how long an inactive
 *        transction should be kept alive.
 * @return {Promise<undefined>} A promise that resolves when the schema is
 *         upgraded to the greatest version specified in the schema
 *         descriptors.
 */
function migrateDatabase(databaseName, schemaDescriptors, currentVersion,
    commitDelay) {
  let descriptorsToProcess = schemaDescriptors.filter((descriptor) => {
    return descriptor.version > currentVersion
  })
  
  if (!descriptorsToProcess.length) {
    return Promise.resolve(undefined)
  }
  
  return migrateDatabaseVersion(
    databaseName,
    descriptorsToProcess[0],
    commitDelay
  ).then(() => {
    return migrateDatabase(
      databaseName,
      descriptorsToProcess,
      descriptorsToProcess[0].version,
      commitDelay
    )
  })
}

/**
 * Performs a single-version database migration to the schema described by the
 * provided database schema descriptor.
 *
 * @param {string} databaseName The native Indexed DB database being migrated.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)} descriptor Schema
 *        descriptor of the version to which the database is to be upgraded.
 * @param {number} commitDelay Delay in milliseconds for how long an inactive
 *        transction should be kept alive.
 * @return {Promise<undefined>} A promise that resolves once the database has
 *         been upgraded to the schema described by the provided schema
 *         descriptor.
 */
function migrateDatabaseVersion(databaseName, descriptor, commitDelay) {
  let fetchPromise
  if (descriptor.fetchBefore && descriptor.fetchBefore.length) {
    let fetcher = new RecordFetcher()
    let objectStores = normalizeFetchBeforeObjectStores(descriptor.fetchBefore)
    fetchPromise = fetcher.fetchRecords(databaseName, commitDelay, objectStores)
  } else {
    fetchPromise = Promise.resolve({})
  }
  
  return fetchPromise.then((recordsMap) => {
    let versionMigrator = new DatabaseVersionMigrator(
      databaseName,
      descriptor.version,
      descriptor.objectStores,
      commitDelay
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
