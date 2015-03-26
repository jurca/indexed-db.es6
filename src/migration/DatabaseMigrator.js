
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
   * 
   * @return {Promise<undefined>} A promise that resolves when the schema is
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
 * @param {IDBDatabase} database The native Indexed DB database being migrated.
 * @param {IDBTransaction} transaction The native {@code versionchange}
 *        transaction.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)[]} schemaDescriptors Schema
 *        descriptors of the database schemas for various versions, sorted in
 *        ascending order by the version number.
 * @param {number} currentVersion The current version of the database schema.
 * @return {Promise<undefined>} A promise that resolves when the schema is
 *         upgraded to the greatest version specified in the schema
 *         descriptors.
 */
function migrateDatabase(database, transaction, schemaDescriptors,
    currentVersion) {
  let descriptorsToProcess = schemaDescriptors.filter((descriptor) => {
    return descriptor.version > currentVersion
  })
  
  return migrateDatabaseVersion(
    database,
    transaction,
    descriptorsToProcess[0]
  ).then(() => {
    return migrateDatabase(
      database,
      transaction,
      descriptorsToProcess,
      descriptorsToProcess[0].version
    )
  })
}

/**
 * Performs a single-version database migration to the schema described by the
 * provided database schema descriptor.
 *
 * @param {IDBDatabase} database The native Indexed DB database being migrated.
 * @param {IDBTransaction} nativeTransaction The native {@code versionchange}
 *        transaction.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema)} descriptor Schema
 *        descriptor of the version to which the database is to be upgraded.
 * @return {Promise<undefined>} A promise that resolves once the database has
 *         been upgraded to the schema described by the provided schema
 *         descriptor.
 */
function migrateDatabaseVersion(database, nativeTransaction, descriptor) {
  let transaction = new Transaction(nativeTransaction, () => {
    return nativeTransaction
  })
  let objectStores = descriptor.fetchBefore || []
  
  return fetchRecords(transaction, objectStores).then((recordsMap) => {
    upgradeSchema(database, nativeTransaction, descriptor)
    
    if (descriptor.after) {
      return Promise.resolve(descriptor.after(transaction, recordsMap))
    }
  })
}

/**
 * Updates the schema of the provided Indexed DB database to the schema
 * specified by the provided schema descriptors.
 * 
 * @param {IDBDatabase} database The native Indexed DB database being migrated.
 * @param {IDBTransaction} nativeTransaction The native {@code versionchange}
 *        transaction.
 * @param ((DatabaseSchema|UpgradedDatabaseSchema)) descriptor Schema
 *        descriptor of the version to which the database is to be upgraded.
 */
function upgradeSchema(database, nativeTransaction, descriptor) {
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
        nativeTransaction.objectStore(objectStoreName) : null

    let objectStoreMigrator = new ObjectStoreMigrator(database,
        nativeObjectStore, objectStoreDescriptor)
    objectStoreMigrator.executeMigration()
  })
}

/**
 * Fetches all records from the specified object stores using the provided
 * read-write transaction.
 * 
 * @param {Transaction} transaction The read-write transaction to use to fetch
 *        all the records.
 * @param {(string|{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)=})[]}
 *        objectStores The names of object stores that should have their
 *        records fetch or (possibley partially filled) object store fetch
 *        descriptors, mixed in an array.
 * @return {Promise<Object<string, string, {key: (number|string|Date|Array), record: *}[]>>}
 *         A promise that resolves once all the records have been fetched and
 *         the records marked for deletion were deleted.
 *         The promise resolves to a map of object store names to the records
 *         fetched from the object store, except for the records marked for
 *         skipping or deletion.
 */
function fetchRecords(transaction, objectStores) {
  if (!objectStores.length) {
    return Promise.resolve({})
  }
  
  let normalizedObjectStores = normalizeFetchBeforeObjectStores(objectStores)
  
  return new Promise((resolveAll, rejectAll) => {
    Promise.all(normalizedObjectStores).map((objectStore) => {
      return fetchObjectStoreRecords(
        transaction.getObjectStore(objectStore.objectStore),
        objectStore.preprocessor
      )
    }).then((fetchedRecords) => {
      let recordsMap = {}
      for (let i = 0; i < objectStores.length; i++) {
        recordsMap[normalizedObjectStores[i].objectStore] = fetchedRecords[i]
      }
      resolveAll(recordsMap)
    }).catch(rejectAll)
  })
}

/**
 * Extracts all records from the provided object store and preprocesses them
 * using the provided preprocessor.
 * 
 * The method traverses the records of the object store in ascending order of
 * their primary keys, deleting the records for which the preprocessor returns
 * the {@codelink UpgradedDatabaseSchema.DELETE_RECORD} before traversing to
 * the next record.
 * 
 * @param {ObjectStore} objectStore The read-write accessor the object store
 *        from which the records should be read.
 * @param {function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)}
 *        preprocessor The callback to call on each record. The value retuned
 *        by it will be stored in the resulting record array instead of the
 *        original record.
 *        The record will not be included in the resulting record array if the
 *        preprocessor returns {@codelink UpgradedDatabaseSchema.SKIP_RECORD}
 *        or {@codelink UpgradedDatabaseSchema.DELETE_RECORD}.
 * @return {Promise<{key: (number|string|Date|Array), record: *}[]>} A promise
 *         that resolves once all records in the object store have been
 *         traversed. The promise will resolve to an array of the records
 *         processed by the provided record preprocessor, in the order they
 *         were traversed, and not containing the records that the preprocessor
 *         marked as to be skipped or deleted.
 */
function fetchObjectStoreRecords(objectStore, preprocessor) {
  return new Promise((resolve, reject) => {
    let records = []
    
    let cursorPromise = objectStore.openCursor()
    cursorPromise.
        then(iterate).
        catch(reject)
    
    function iterate(cursor) {
      if (cursor.done) {
        resolve(records)
        return
      }
      
      let preprocessed = preprocessor(cursor.record, cursor.primaryKey)
      if (preprocessed === UpgradedDatabaseSchema.DELETE_RECORD) {
        cursor.delete().
            then(() => cursor.advance()).
            then(iterate).
            catch(reject)
        return
      } else if (preprocessed !== UpgradedDatabaseSchema.SKIP_RECORD) {
        records.push({
          key: cursor.primaryKey,
          record: preprocessed
        })
      } else {
        // SKIP_RECORD returned, do nothing
      }
      
      cursor.advance().
          then(iterate).
          catch(reject)
    }
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
