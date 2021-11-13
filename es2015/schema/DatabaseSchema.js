
import {isVersionValid, getDuplicateNames} from "./validation.js"

/**
 * Descriptor of database schema used to describe the schema ONLY FOR the
 * INITIAL version of the database. Use the {@linkcode UpgradedDatabaseSchema}
 * and {@linkcode DatabaseSchemaDiff} classes to specify the schema of upgraded
 * database versions.
 */
export default class DatabaseSchema {
  /**
   * Initializes the initial database schema descriptor.
   *
   * @param {number} version The database version number, specified as a
   *        positive integer.
   * @param {...ObjectStoreSchema} objectStores The schema of the object stores
   *        to be present in the database.
   */
  constructor(version, ...objectStores) {
    if (!isVersionValid(version)) {
      throw new TypeError("The version must be a positive integer, " +
          `${version} provided`)
    }

    let duplicateNames = getDuplicateNames(objectStores)
    if (duplicateNames.length) {
      throw new Error("The following object stores are defined multiple " +
          `times: ${duplicateNames.join(", ")}`)
    }

    /**
     * The database version number, specified as a positive integer.
     *
     * @type {number}
     */
    this.version = version

    /**
     * Object stores to be defined in this version of the database.
     *
     * @type {ObjectStoreSchema[]}
     */
    this.objectStores = objectStores

    Object.freeze(this)
  }
}
