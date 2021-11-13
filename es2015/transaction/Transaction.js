
import ObjectStore from "../object-store/ObjectStore.js"
import ReadOnlyTransaction from "./ReadOnlyTransaction.js"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  transaction: Symbol("transaction"),
  transactionFactory: Symbol("transactionFactory"),
  objectStores: Symbol("objectStores")
})

/**
 * A transaction with read-write access to the selected object stores.
 */
export default class Transaction extends ReadOnlyTransaction {
  /**
   * Initializes the read-write transaction.
   *
   * @param {IDBTransaction} transaction The IndexedDB native transaction.
   * @param {function(string): ReadOnlyTransaction} transactionFactory The
   *        factory function that creates a new read-only transaction with
   *        access only the to the object store specified by the provided
   *        argument every time the function is invoked.
   */
  constructor(transaction, transactionFactory) {
    super(transaction, transactionFactory)

    /**
     * The native IndexedDB transaction object.
     *
     * @type {IDBTransaction}
     */
    this[FIELDS.transaction] = transaction

    /**
     * The factory function that creates a new read-only transaction with
     * access only the to the object store specified by the provided argument
     * every time the function is invoked.
     *
     * @type {function(string): ReadOnlyTransaction}
     */
    this[FIELDS.transactionFactory] = transactionFactory

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

    let transactionFactory = () => {
      return this[FIELDS.transactionFactory](objectStoreName)
    }

    let idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName)
    let objectStore = new ObjectStore(
      idbObjectStore,
      transactionFactory
    )
    this[FIELDS.objectStores].set(objectStoreName, objectStore)

    return objectStore
  }
}
