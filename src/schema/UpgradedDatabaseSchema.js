
import {isVersionValid, getDuplicitNames} from "./validation"

/**
 * Descriptor of a database schema after an upgrade. Use this to specify the
 * database schema of databases that had its schema upgraded. Cannot be used
 * for the first version of the database.
 */
export default class UpgradedDatabaseSchema {
  /**
   * Initializes the schema of an upgraded database.
   *
   * @param {number} version The version of the upgraded database schema. Must
   *        be a positive integer greater than 1.
   * @param {function(ReadOnlyTransaction): *} before The callback to execute
   *        before the database schema is upgraded.
   * @param {ObjectStoreSchema} objectStores The schemas of the object stores
   *        in the upgraded database.
   * @param {function(Transaction, *)} after The callback te exectue after the
   *        database schema is upgraded.
   */
  constructor(version, before, objectStores, after = () => {}) {
    if (!isVersionValid(version)) {
      throw new TypeError("The version must be a positive integer, " +
          `${version} provided`)
    }
    if (version < 2) {
      throw new Error("The upgraded database schema must have a version " +
          `number greater than 1, ${version} provided`)
    }

    let duplicitNames = getDuplicitNames(objectStores)
    if (duplicitNames.length) {
      throw new Error("The following object stores are defined multiple " +
          `times: ${duplicitNames.join(", ")}`)
    }

    /**
     * The version number of the database to which this schema upgrades. The
     * version is a positive integer.
     *
     * @type {number}
     */
    this.version = version

    /**
     * Callback to execute before the database schema is upgraded. The callback
     * receives a read-only transaction for reading the data from the current
     * data stores in the database that need to be modified or copied once the
     * database structure is upgraded.
     *
     * Any data returned by this callback will be passed to the
     * {@codelink after} callback as the second argument.
     *
     * Please note that the callback must request all the operations
     * synchronously on its invokation, as the database structured will be
     * modified right after the callback has been invoked, therefore waiting
     * for some operations to finish before requesting more operations may lead
     * to concurrency issues and data corruption.
     *
     * @type {function(ReadOnlyTransaction): *}
     */
    this.before = before || (() => {})

    /**
     * Definitions of the database object stores, describing the database
     * schema in this version.
     *
     * The database upgrade mechanism supports the following changes:
     * - adding a new data store
     * - removing an existing data store
     * - the following changes on data store indexes:
     *   - adding a new index
     *   - removing an existing index
     *   - changing the key path(s)
     *   - changing the {@code unique} flag
     *   - changing the {@code multiEntry} flag
     *
     * Since changing the object store primary key path and
     * {@code autoIncrement} flag is not supported, such changes must be made
     * using the following steps:
     * 1. fetch all records from the old data store using the
     *    {@codelink before} callback
     * 2. ommit the old data store in this array of object store schemas to
     *    destroy it
     * 3. create a new data store with the required properties by specifying it
     * 4. insert the extracted records into the new data store using the
     *    {@codelink after} callback.
     *
     * These definitions are applied after executing the {@codelink before}
     * callback.
     *
     * @type {ObjectStoreSchema[]}
     */
    this.objectStores = objectStores

    /**
     * Callback to execute after the database schema has been upgraded to the
     * schema specified by the {@codelink objectStores}.
     *
     * The callback will receive a read-write transaction to the new database
     * and the data returned by the {@codelink before} callback as arguments.
     *
     * Please note that the callback must request all the operations
     * synchronously on its invokation, as it might not be the last database
     * upgrade callback in the chain, and waiting for some operations to finish
     * before requesting more operations may lead to concurrency issues and
     * data corruption.
     *
     * @type {function(Transaction, *)}
     */
    this.after = after

    Object.freeze(this)
  }
}
