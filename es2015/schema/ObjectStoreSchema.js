
import IndexSchema from "./IndexSchema"
import {getDuplicateNames} from "./validation"

/**
 * Database object store schema descriptor.
 */
export default class ObjectStoreSchema {
  /**
   * Initializes the object store schema descriptor.
   *
   * @param {string} storeName The name of this object store.
   * @param {string=} keyPath The path to the primary key field, or an empty
   *        string if the primary keys are to be stored out-of-line.
   * @param {boolean=} autoIncrement When {@code true}, the record primary keys
   *        will be generated automatically for new records.
   * @param {...IndexSchema} indexes The indexes to be defined on this object store.
   */
  constructor(storeName, keyPath = "", autoIncrement = false, ...indexes) {
    let duplicateNames = getDuplicateNames(indexes)
    if (duplicateNames.length) {
      throw new Error("The following indexes are defined multiple times:" +
          duplicateNames.join(", "))
    }

    /**
     * The name of this object store in the database. The name must be unique
     * within the database.
     *
     * @type {string}
     */
    this.name = storeName

    /**
     * Specified the path to the record field containing the record primary
     * key. The field path is a sequence of field names joined by dots, for
     * example {@code "id"} or {@code "foo.bar.primaryKeyField"}, or an array
     * of field paths if the object store uses a compound key.
     *
     * When specified (a non-empty string), the records of this object store
     * must be objects (that can be structure-cloned, see below) and their
     * primary keys are stored in the field specified by this field path (also
     * referred to as storing the primary key in-line).
     *
     * When set to an empty string ({@code ""}) or {@code null}, the primary
     * key is stored outside of the records (also referred to as storing the
     * primary key out-of-line). This allows to store non-object values as
     * records.
     *
     * @type {?(string|string[])}
     */
    this.keyPath = keyPath

    /**
     * When {@code true}, the keys of the records are generated automatically
     * for new records by the storage. The generated keys will be positive
     * integers generated in sequence. The first generated key will be
     * {@code 1}. Note that each object store with generated keys has its own
     * key generator.
     *
     * When {@code false}, the newly created records must have their keys
     * specified.
     *
     * @type {boolean}
     */
    this.autoIncrement = autoIncrement

    /**
     * The indexes defined on this object store.
     *
     * @type {IndexSchema[]}
     */
    this.indexes = indexes

    Object.freeze(this)
  }
}
