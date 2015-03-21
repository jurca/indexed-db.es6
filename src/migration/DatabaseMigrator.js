
import ObjectStoreMigrator from "./ObjectStoreMigrator"
import DatabaseSchema from "../schema/DatabaseSchema"
import UpgradedDatabaseSchema from "../schema/UpgradedDatabaseSchema"
import ReadOnlyTransaction from "../transaction/ReadOnlyTransaction"
import Transaction from "../transaction/Transaction"

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
   * @param {IDBDatabase} database The native Indexed DB database connection.
   * @param {IDBTransaction} transaction The native Indexed DB
   *        {@code versionchange} transaction.
   * @param {(DatabaseSchema|UpgradedDatabaseSchema)[]} schemaDescriptors
   *        Descriptors of the database schema for all known database versions.
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
    if (!(sortedSchemasCopy[0] instanceof DatabaseSchema)) {
      throw new TypeError("The schema descriptor of the lowest described " +
          `database version (${sortedSchemasCopy[0].version}) must be a ` +
          "DatabaseSchema instance")
    }
    sortedSchemasCopy.slice(1).forEach((descriptor) => {
      if (!(descriptor instanceof UpgradedDatabaseSchema)) {
        throw new TypeError("The schema descriptors of the upgraded " +
            "database versions must be UpgradedDatabaseSchema instances, " +
            `but the provided descriptor of version ${descriptor.version} ` +
            "was not")
      }
    })
    let isVersionValid = (currentVersion < 0) ||
        (parseInt(currentVersion, 10) !== currentVersion)
    if (isVersionValid) {
      throw new Error("The version number must be either a positive " +
          "integer, or 0 if the database is being created")
    }

    /**
     * The native Indexed DB database connection.
     *
     * @type {@IDBDatabase}
     */
    this[FIELDS.database] = database

    /**
     * The native Indexed DB {@code versionchange} transaction.
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
   */
  executeMigration() {
    this[FIELDS.schemaDescriptors].filter((descriptor) => {
      return descriptor.version > this[FIELDS.currentVersion]
    }).forEach((descriptor) => {
      migrateDatabaseVersion(
        this[FIELDS.database],
        this[FIELDS.transaction],
        descriptor
      )
    })
  }
}

/**
 * Performs a single-version database migration to the schema described by the
 * provided database schema descriptor.
 *
 * @param {IDBDatabase} database The native Indexed DB databaes being migrated.
 * @param {IDBTransaction} transaction The native {@code versionchange}
 *        transaction.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)} descriptor Schema
 *        descriptor of the version to which the database is to be upgraded.
 */
function migrateDatabaseVersion(database, transaction, descriptor) {
  let beforeCallbackResult

  if (descriptor.before) {
    let transaction = new ReadOnlyTransaction(transaction, () => {
      return transaction
    })
    beforeCallbackResult = descriptor.before(transaction)
  }

  let objectStoreNames = [].slice.call(database.objectStoreNames)
  let newObjectStoreNames = descriptor.objectStores.map((objectStore) => {
    return objectStore.name
  })
  objectStoreNames.forEach((objectStoreName) => {
    if (newObjectStoreNames.indexOf(objectStoreName) === -1) {
      database.deleteObjectStore(objectStoreName)
    }
  })

  descriptor.objectStores.forEach((objectStoreDescriptor) => {
    let objectStoreName = objectStoreDescriptor.name
    let nativeObjectStore = objectStoreNames.indexOf(objectStoreName) > -1 ?
        transaction.objectStore(objectStoreName) : null

    let objectStoreMigrator = new ObjectStoreMigrator(database,
        nativeObjectStore, objectStoreDescriptor)
    objectStoreMigrator.executeMigration()
  })

  if (descriptor.after) {
    let transaction = new Transaction(transaction, () => {
      return transaction
    })
    descriptor.after(transaction, beforeCallbackResult)
  }
}
