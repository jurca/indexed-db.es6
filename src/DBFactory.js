
import Database from "./Database"
import DatabaseMigrator from "./migration/DatabaseMigrator"

/**
 * Registered listeners to be executed when a database schema migration is
 * started. The listeners will be executed with the folowing arguments:
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
 * The DB Provider provides a high-level {@codelink Promise}-enabled API
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
 * Record keys can be {@code number}s (except for {@codelink NaN}),
 * {@code string}s, {@codelink Date} instances (unless the internal value is a
 * {@codelink NaN}) or {@codelink Array} objects. An {@codelink Array} is only
 * a valid key if every item in the array is defined and is a valid key (i.e.
 * sparse arrays can not be valid keys) and if the {@codelink Array} doesn't
 * directly or indirectly contain itself. For more details, see
 * http://www.w3.org/TR/IndexedDB/#dfn-valid-key
 *
 * While {@codelink Array}s containing {@codelink Array}s are considered to be
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
   * versions greater than the curent version in the ascending order.
   *
   * The database version is always a positive integer. The version numbers
   * specified by the descriptors do not have to start at {@code 1} and may
   * contain gaps of any size.
   *
   * @param {string} databaseName The name of the database.
   * @param {...(DatabaseSchema|UpgradedDatabaseSchema)} schemaDescriptors The
   *        descriptors of the database schema across all its versions. The
   *        descriptor of the lowest version must be a
   *        {@codelink DatabaseSchema} instance, all other must be
   *        {@codelink UpgradedDatabaseSchema} instances. The order of the
   *        descriptors does not matter.
   *        At least one schema descriptor must be provided.
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

    let requestedVersion = sortedSchemaDescriptors.slice().pop().version
    let request = indexedDB.open(databaseName, requestedVersion)

    return new Promise((resolve, reject) => {
      let migrationPromiseResolver, migrationPromiseRejector;
      let migrationPromise = new Promise((resolve, reject) => {
        migrationPromiseResolver = resolve
        migrationPromiseRejector = reject
      })
      
      request.onsuccess = () => {
        let database = new Database(request.result)
        resolve(database)
        migrationPromiseResolver()
      }

      request.onupgradeneeded = (event) => {
        executeMigrationListeners(databaseName, event.oldVersion,
            requestedVersion, migrationPromise)
        
        let database = request.result
        let transaction = request.transaction

        database.onerror = (errorEvent) => {
          reject(errorEvent)
          migrationPromiseRejector(errorEvent)
        }

        let migrator = new DatabaseMigrator(database, transaction,
            sortedSchemaDescriptors, event.oldVersion)
        migrator.executeMigration()
      }

      request.onerror = () => {
        reject(request.error)
        migrationPromiseRejector(request.error)
      }
      request.onblocked = () => {
        let error = new Error("A database upgrade was needed, but could not " +
            "be performed, because the attempt was blocked by a connection " +
            "that remained opened after receiving the notification")
        reject(error)
        migrationPromiseRejector(error)
      }
    })
  }

  /**
   * Attempts to delete the specified database.
   *
   * The method will trigger the databse deletion handlers on all open database
   * conections. The attempt will fail if any of the handlers will not close
   * the database connection, thus blocking the deletion request.
   *
   * The method will resolve to the version number of the deleted database on
   * success, or {@code null} if the database did not exist.
   *
   * Deleting a non-existing database is always successful.
   *
   * In case the request fails, the returned promise will resolve into the
   * error that that occured.
   *
   * @param {string} databaseName The name of the database to delete.
   * @return {Promise<?number>} The promise that resolves to the version number
   *         of the deleted database, or {@code null} if the database did not
   *         exist.
   */
  static deleteDatabase(databaseName) {
    let request = indexedDB.deleteDatabase(databaseName)
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event.oldVersion)
      request.onerror = (event) => reject(event)
    })
  }
  
  /**
   * Registers the specified listener to be executed whenever a database schema
   * migration is started. The listeners will be executed with the folowing
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
}

/**
 * Executes the currently registered database schema migration listeners with
 * the provided arguments.
 * 
 * @param {string} databaseName The name of the database being migrated.
 * @param {number} the version number from which the schema is being migrated.
 * @param {number} the version number to which the schema is being migrated.
 * @param {Promise<undefined>} a promise that resolves when the migration is
 *        finished.
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
