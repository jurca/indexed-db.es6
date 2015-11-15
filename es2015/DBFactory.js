
import Database from "./Database"
import NativeDBAccessor from "./NativeDBAccessor"
import PromiseSync from "./PromiseSync"
import DatabaseMigrator from "./migration/DatabaseMigrator"

/**
 * Registered listeners to be executed when a database schema migration is
 * started. The listeners will be executed with the following arguments:
 * 
 * - database name
 * - the version number from which the schema is being migrated
 * - the version number to which the schema is being migrated
 * - a promise that resolves when the migration is finished
 * 
 * @type {Set<function(string, number, number, Promise<undefined>)>}
 */
const migrationListeners = new Set()

/**
 * Provider of connections to the database, manager of database versioning and
 * utility for deleting databases.
 *
 * The DB Provider provides a high-level {@linkcode Promise}-enabled API
 * wrapper of IndexedDB, so there are a few limitations to consider:
 *
 * A record can be any value that can be converted to JSON or structure-cloned.
 * For details about structured cloning, see
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/The_structured_clone_algorithm
 * or
 * http://www.w3.org/html/wg/drafts/html/master/infrastructure.html#safe-passing-of-structured-data
 *
 * While it is possible to use compound keys on object stores and indexes, some
 * browsers do not implement support for this, so creating or using such an
 * object store or index will probably result in an error.
 *
 * Record keys can be {@code number}s (except for {@linkcode NaN}),
 * {@code string}s, {@linkcode Date} instances (unless the internal value is a
 * {@linkcode NaN}) or {@linkcode Array} objects. An {@linkcode Array} is only
 * a valid key if every item in the array is defined and is a valid key (i.e.
 * sparse arrays can not be valid keys) and if the {@linkcode Array} doesn't
 * directly or indirectly contain itself. For more details, see
 * http://www.w3.org/TR/IndexedDB/#dfn-valid-key
 *
 * While {@linkcode Array}s containing {@linkcode Array}s are considered to be
 * valid keys, some browsers do not process such keys properly when getting a
 * value from an object store, so such an operation may result in
 * {@code undefined} value even if the record exists.
 */
export default class DBFactory {
  /**
   * Opens a new connection to the database.
   *
   * When the database is being opened, its version is being tested against the
   * greatest version described in the provided schema descriptors. If the
   * current database version is lower than the greatest version defined, or
   * the database does not exist (the version is considered to be {@code 0}
   * then), the method will upgrade the database.
   *
   * The database upgrade consists of processing the schema descriptors for all
   * versions greater than the current version in the ascending order.
   *
   * The database version is always a positive integer. The version numbers
   * specified by the descriptors do not have to start at {@code 1} and may
   * contain gaps of any size.
   * 
   * Note that this method handles opening the connection slightly differently
   * when the database version is to be upgraded and the request is blocked:
   * 
   * This method will reject the returned promise immediately if the attempt is
   * blocked. The native Indexed DB connection open request would behave
   * slightly differently, that is, if all pending connections to the database
   * are closed, the Indexed DB will fire the {@code upgradeneeded} and
   * {@code success} events, even though the {@code blocked} event has been
   * previously fired on the open request.
   * 
   * Since this behavior of the native Indexed DB is considered
   * counter-intuitive this method simplifies this special case by ignoring the
   * native events received after the {@code blocked} event and rejecting the
   * returned promise.
   *
   * @param {string} databaseName The name of the database.
   * @param {...(DatabaseSchema|UpgradedDatabaseSchema|Object)} schemaDescriptors
   *        The descriptors of the database schema across all its versions. The
   *        descriptor of the lowest version must be a
   *        {@linkcode DatabaseSchema} instance, all other must be
   *        {@linkcode UpgradedDatabaseSchema} instances.
   *        Alternatively, plain object that follow the structure of the
   *        {@linkcode DatabaseSchema} and {@linkcode UpgradedDatabaseSchema}
   *        instances may be used instead, if preferred. Plain objects must not
   *        be mixed with the {@linkcode DatabaseSchema} and
   *        {@linkcode UpgradedDatabaseSchema} instances.
   *        The order of the descriptors does not matter. At least one schema
   *        descriptor must be provided.
   * @return {Promise<Database>} A promise that resolves to the database
   *         connection.
   */
  static open(databaseName, ...schemaDescriptors) {
    if (!schemaDescriptors.length) {
      throw new Error("The list of schema descriptors must not be empty")
    }

    let sortedSchemaDescriptors = schemaDescriptors.slice().sort((d1, d2) => {
      return d1.version - d2.version
    })

    return openConnection(
      databaseName,
      sortedSchemaDescriptors
    )
  }

  /**
   * Attempts to delete the specified database.
   *
   * The method will trigger the database deletion handlers on all open
   * database connections. The attempt will fail if any of the handlers will
   * not close the database connection, thus blocking the deletion request.
   *
   * The method will resolve to the version number of the deleted database on
   * success, or {@code null} if the database did not exist.
   *
   * Deleting a non-existing database is always successful.
   *
   * In case the request fails, the returned promise will reject with the error
   * that that occurred.
   *
   * @param {string} databaseName The name of the database to delete.
   * @return {Promise<?number>} The promise that resolves to the version number
   *         of the deleted database, or {@code null} if the database did not
   *         exist.
   */
  static deleteDatabase(databaseName) {
    let request = NativeDBAccessor.indexedDB.deleteDatabase(databaseName)
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event.oldVersion)
      request.onerror = (event) => reject(event)
    })
  }
  
  /**
   * Registers the specified listener to be executed whenever a database schema
   * migration is started. The listeners will be executed with the following
   * arguments:
   * 
   * - database name
   * - the version number from which the schema is being migrated, set to 0 if
   *   the database is being created
   * - the version number to which the schema is being migrated
   * - a promise that resolves when the migration is finished
   * 
   * Any error throw by the listener will be logged as a warning, but will not
   * disrupt the execution of the remaining listeners.
   * 
   * @param {function(string, number, number, Promise<undefined>)} listener The
   *        listener to register.
   */
  static addMigrationListener(listener) {
    migrationListeners.add(listener)
  }
  
  /**
   * Unregisters the specified database schema migration listener. This method
   * has no effect if the listener is not registered.
   * 
   * @param {function(string, number, number, Promise<undefined>)} listener The
   *        listener to unregister.
   */
  static removeMigrationListener(listener) {
    migrationListeners.delete(listener)
  }

  /**
   * Sets the IndexedDB implementation to use by indexed-db.es6.
   *
   * @param {IDBFactory} indexedDBImplementation The new IndexedDB
   *        implementation to use.
   */
  static set nativeIndexedDB(indexedDBImplementation) {
    NativeDBAccessor.indexedDB = indexedDBImplementation
  }

  /**
   * Returns the current IndexedDB implementation used by indexed-db.es6.
   *
   * @return {IDBFactory} The native IndexedDB implementation to use.
   */
  static get nativeIndexedDB() {
    return NativeDBAccessor.indexedDB
  }
}

/**
 * Handles opening the connection to the database and wraps the whole process
 * in a promise.
 * 
 * @param {string} databaseName The name of the Indexed DB database to connect
 *        to.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema|Object)[]} sortedSchemaDescriptors
 *        The database schema descriptors, sorted in ascending order by the
 *        schema version number.
 * @return {Promise<Database>} A promise that resolves to the database
 *         connection.
 */
function openConnection(databaseName, sortedSchemaDescriptors) {
  let version = sortedSchemaDescriptors.slice().pop().version
  let request = NativeDBAccessor.indexedDB.open(databaseName, version)
  
  return new Promise((resolve, reject) => {
    let wasBlocked = false
    let upgradeTriggered = false
    
    let migrationPromiseResolver, migrationPromiseRejector
    let migrationPromise = new Promise((resolve, reject) => {
      migrationPromiseResolver = resolve
      migrationPromiseRejector = reject
    })
    // prevent leaking the same error to the console twice
    migrationPromise.catch(() => {})
    
    request.onsuccess = () => {
      let database = new Database(request.result)
      resolve(database)
      migrationPromiseResolver()
    }

    request.onupgradeneeded = (event) => {
      if (!wasBlocked) {
        upgradeTriggered = true
      }
      
      let database = request.result
      let transaction = request.transaction
      
      if (wasBlocked) {
        transaction.abort()
        return
      }
      
      upgradeDatabaseSchema(databaseName, event, migrationPromise, database,
          transaction, sortedSchemaDescriptors, migrationPromiseResolver,
          migrationPromiseRejector).catch((error) => {
        transaction.abort()
      })
    }

    request.onerror = (event) => {
      handleConnectionError(event, request.error, wasBlocked, upgradeTriggered,
          reject, migrationPromiseRejector)
    }
    
    request.onblocked = () => {
      wasBlocked = true
      
      let error = new Error("A database upgrade was needed, but could not " +
          "be performed, because the attempt was blocked by a connection " +
          "that remained opened after receiving the notification")
      reject(error)
      migrationPromiseRejector(error)
    }
  })
}

/**
 * Handles a database error encountered during connection establishing.
 * 
 * @param {Event} event The error event.
 * @param {Error} error The encountered error.
 * @param {boolean} wasBlocked Flag signalling whether the connection has been
 *        blocked.
 * @param {boolean} upgradeTriggered Flag signalling whether the database schema
 *        upgrade process was triggered.
 * @param {function(Error)} reject The connection promise rejection callback.
 * @param {function(Error)} migrationPromiseRejector The schema migration
 *        promise rejection callback.
 */
function handleConnectionError(event, error, wasBlocked, upgradeTriggered,
    reject, migrationPromiseRejector) {
  if (wasBlocked || upgradeTriggered) {
    event.preventDefault()
    return
  }
  
  reject(request.error)
  migrationPromiseRejector(request.error)
}

/**
 * Handles the provided {@code upgradeneeded} event that occurred during
 * opening a database that was not blocked. The function handles database
 * schema upgrade.
 * 
 * @param {string} databaseName The name of the database to upgrade.
 * @param {Event} event The {@code upgradeneeded} event.
 * @param {Promise<undefined>} migrationPromise The database schema migration
 *        promise to pass to the migration listeners.
 * @param {IDBDatabase} database The native Indexed DB database to upgrade.
 * @param {IDBTransaction} transaction The native {@code versionchange}
 *        transaction to use to manipulate the data.
 * @param {(DatabaseSchema|UpgradedDatabaseSchema|Object)[]} sortedSchemaDescriptors
 *        The database schema descriptors, sorted in ascending order by the
 *        schema version number.
 * @param {function()} migrationPromiseResolver Schema migration promise
 *        resolver.
 * @param {function(Error)} migrationPromiseRejector Schema migration promise
 *        rejection callback.
 * @return {PromiseSync<undefined>} A promise resolved when the schema has been
 *         upgraded.
 */
function upgradeDatabaseSchema(databaseName, event, migrationPromise,
    database, transaction, sortedSchemaDescriptors, migrationPromiseResolver,
    migrationPromiseRejector) {
  executeMigrationListeners(databaseName, event.oldVersion, event.newVersion,
      migrationPromise)
  
  let migrator = new DatabaseMigrator(
    database,
    transaction,
    sortedSchemaDescriptors,
    event.oldVersion
  )
  
  return PromiseSync.resolve().then(() => {
    return migrator.executeMigration()
  }).then(() => {
    migrationPromiseResolver()
  }).catch((error) => {
    migrationPromiseRejector(error)
    throw error
  })
}

/**
 * Executes the currently registered database schema migration listeners with
 * the provided arguments.
 * 
 * @param {string} databaseName The name of the database being migrated.
 * @param {number} oldVersion The version number from which the schema is being
 *        migrated.
 * @param {number} newVersion The version number to which the schema is being
 *        migrated.
 * @param {Promise<undefined>} completionPromise A promise that resolves when
 *        the migration is finished.
 */
function executeMigrationListeners(databaseName, oldVersion, newVersion,
    completionPromise) {
  for (let listener of migrationListeners) {
    try {
      listener(databaseName, oldVersion, newVersion, completionPromise)
    } catch (e) {
      console.warn("A schema migration event listener threw an error", e);
    }
  }
}
