
import Database from "./Database"

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
 * {@codelink NaN}) or {@code Array} objects. An {@codelink Array} is only a
 * valid key if every item in the array is defined and is a valid key (i.e.
 * sparse arrays can not be valid keys) and if the {@codelink Array} doesn't
 * directly or indirectly contain itself. For more details, see
 * http://w3c.github.io/IndexedDB/#dfn-valid-key
 *
 * While {@codelink Array}s containing {@codelink Array}s are considered to be
 * valid keys, some browsers do not process such keys properly when getting a
 * value from an object store, so such an operation may result in
 * {@code undefined} value even if the record exists.
 */
export default class DBProvider {
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
   */
  static open(databaseName, ...schemaDescriptors) {
    let sortedSchemaDescriptors = schemaDescriptors.sort((d1, d2) => {
      return d2.version - d1.version
    })

    let requestedVersion = sortedSchemaDescriptors.slice().pop().version

    let request = indexedDB.open(databaseName, requestedVersion)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        let database = new Database(request.result)
        resolve(database)
      }

      request.onupgradeneeded = () => {
        let database = request.result
        let transaction = request.transaction
        // TODO: execute upgrade
      }

      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("A database upgrade was " +
          "needed, but could not be performed, because the attempt was " +
          "blocked by a connection that remained opened after receiving the " +
          "notification"))
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
}
