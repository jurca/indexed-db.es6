
import ObjectStore from "../object-store/ReadOnlyObjectStore"
import ReadOnlyTransaction from "./ReadOnlyTransaction"

const FIELDS = Object.freeze({
  objectStores: Symbol("objectStores"),
  transaction: Symbol("transaction")
})

/**
 * A transaction with read-write access to the selected object stores.
 */
export default class Transaction extends ReadOnlyTransaction {
  /**
   * Initializes the read-write transaction.
   *
   * @param {IDBTransaction} transaction The IndexedDB native transaction.
   */
  constructor(transaction) {
    super(transaction)

    /**
     * The native IndexedDB transaction object.
     *
     * @type {IDBTransaction}
     */
    this[FIELDS.transaction] = transaction

    /**
     * Cache of created object store instances. The keys are the names of the
     * object stores.
     *
     * @type {Map<string, ObjectStore>}
     */
    this[FIELDS.objectStores] = new Map()

    Object.freeze(this)
  }

  /**
   * Returns the read-write object store of the specified name. The method
   * returns the same object store if called repeatedly with the same argument.
   *
   * @override
   * @param {string} objectStoreName The name of the object store to retrieve.
   * @return {ObjectStore} The object store.
   */
  getObjectStore(objectStoreName) {
    if (this[FIELDS.objectStores].has(objectStoreName)) {
      return this[FIELDS.objectStores].get(objectStoreName)
    }

    let idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName)
    let objectStore = new ObjectStore(idbObjectStore)
    this[FIELDS.objectStores].set(objectStoreName, objectStore)

    return objectStore
  }
}
