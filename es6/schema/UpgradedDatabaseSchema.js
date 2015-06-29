
import {isVersionValid, getDuplicateNames} from "./validation"

/**
 * Record preprocessors (used in the {@linkcode fetchBefore}) return this token
 * to exclude the current record from the record array passed to the
 * after-migration callback.
 * 
 * @type {Object}
 */
const SKIP_RECORD = Object.freeze({})

/**
 * Record preprocessors (used in the {@linkcode fetchBefore}) return this token
 * to mark the record for deletion.
 * 
 * @type {Object}
 */
const DELETE_RECORD = Object.freeze({})

/**
 * Descriptor of a database schema after an upgrade. Use this to specify the
 * database schema of databases that had its schema upgraded. Cannot be used
 * for the first version of the database.
 */
export default class UpgradedDatabaseSchema {
  /**
   * Record preprocessors (used in the {@linkcode fetchBefore}) return this
   * token to exclude the current record from the record array passed to the
   * after-migration callback.
   * 
   * The token is immutable.
   * 
   * @return {Object} Token returned by record preprocessors for records that
   *         should be excluded from the record array passed to the
   *         after-migration callback.
   */
  static get SKIP_RECORD() {
    return SKIP_RECORD
  }
  
  /**
   * Record preprocessors (used in the {@linkcode fetchBefore}) return this
   * token to mark the record for deletion.
   * 
   * The token is immutable.
   * 
   * @return {Object} Token returned by record preprocessors for records that
   *         should be deleted.
   */
  static get DELETE_RECORD() {
    return DELETE_RECORD
  }
  
  /**
   * Initializes the schema of an upgraded database.
   *
   * @param {number} version The version of the upgraded database schema. Must
   *        be a positive integer greater than 1.
   * @param {?(string|{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD|*)=})[]} fetchBefore
   *        Object stores from which the records should be fetched before the
   *        schema will be migrated, with optional record preprocess callbacks.
   * @param {ObjectStoreSchema[]} objectStores The schemas of the object stores
   *        in the upgraded database.
   * @param {function(Transaction, Object<string, {key: (number|string|Date|Array), record: *}[]>): ?Promise<undefined>} after
   *        The callback te execute after the database schema is upgraded.
   */
  constructor(version, fetchBefore, objectStores, after = () => {}) {
    if (!isVersionValid(version)) {
      throw new TypeError("The version must be a positive integer, " +
          `${version} provided`)
    }
    if (version < 2) {
      throw new Error("The upgraded database schema must have a version " +
          `number greater than 1, ${version} provided`)
    }

    let duplicateNames = getDuplicateNames(objectStores)
    if (duplicateNames.length) {
      throw new Error("The following object stores are defined multiple " +
          `times: ${duplicateNames.join(", ")}`)
    }

    /**
     * The version number of the database to which this schema upgrades. The
     * version is a positive integer.
     *
     * @type {number}
     */
    this.version = version

    /**
     * Array of names of object stores from which all records should be fetched
     * before performing the schema migration. The fetched records will then be
     * passed to the after-migration callback.
     * 
     * Alternatively, the elements may be objects that specify the object name
     * and a callback map/filter function executed to preprocess the records.
     * The callback function will executed with the following arguments:
     * - the record
     * - the primary key of the record (will be frozen to prevent any
     *   modifications)
     * 
     * The callback may return either the preprocessed record, or
     * {@linkcode UpgradedDatabaseSchema.SKIP_RECORD} to indicate that the
     * record should be omitted from the records passed to the after-migration
     * callback, or {@linkcode UpgradedDatabaseSchema.DELETE_RECORD} to both
     * omit the record from the records passed to the after-migration callback
     * and delete the record.
     *
     * @type {(string|{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)=})[]}
     */
    this.fetchBefore = fetchBefore || []

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
     * 1. fetch all records from the old data store using
     *    {@linkcode beforeBefore}
     * 2. omit the old data store in this array of object store schemas to
     *    destroy it
     * 3. create a new data store with the required properties by specifying it
     * 4. insert the extracted records into the new data store using the
     *    {@linkcode after} callback.
     *
     * These definitions are applied after executing the {@codelink before}
     * callback.
     *
     * @type {ObjectStoreSchema[]}
     */
    this.objectStores = objectStores

    /**
     * Callback to execute after the database schema has been upgraded to the
     * schema specified by the {@linkcode objectStores}.
     *
     * The callback will receive a read-write transaction to the new database
     * and a map of object store names specified in the {@linkcode fetchBefore}
     * to the preprocessed records fetched from the object stores.
     * 
     * If the callback returns a {@linkcode Promise}, the database will wait
     * for its completion before finishing the migration process. Due to how
     * the transactions are processed by Indexed DB, the promise MUST resolve
     * when it the last requested database operation is resolved and not after.
     * Otherwise the transaction would be committed automatically and you will
     * probably end up with a half-way done database schema migration if this
     * is not the schema of the greatest defined database version.
     *
     * @type {function(Transaction, Object<string, {key: (number|string|Date|Array), record: *}[]>): ?Promise<undefined>}
     */
    this.after = after || (() => {})

    Object.freeze(this)
  }
}
