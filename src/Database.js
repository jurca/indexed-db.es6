
import ReadOnlyTransaction from "./transaction/ReadOnlyTransaction"
import Transaction from "./transaction/Transaction"

/**
 * Constants representing the available transaction modes.
 *
 * @type {Object<string, string>}
 */
const TRANSACTION_MODES = Object.freeze({
  READ_ONLY: "readonly",
  READ_WRITE: "readwrite"
})

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  database: Symbol("database"),
  versionChangeListeners: Symbol("versionChangeListeners")
})

/**
 * Database connection, used to create transactions for accessing and
 * manipulating the data in the database.
 */
export default class Database {
  /**
   * Initializes the database connection.
   *
   * @param {IDBDatabase} database The native connection to the Indexed DB
   *        database.
   */
  constructor(database) {
    /**
     * The name of the database.
     *
     * @type {string}
     */
    this.name = database.name

    /**
     * The current version of the database, specified as a positive integer.
     *
     * @type {number}
     */
    this.version = database.version

    /**
     * The names of the object stores available in the database. The names are
     * sorted in the ascending order.
     *
     * @type {string[]}
     */
    this.objectStoreNames =
        Object.freeze([].slice.call(database.objectStoreNames))

    /**
     * The native connection to the Indexed DB database.
     *
     * @type {IDBDatabase}
     */
    this[FIELDS.database] = database

    /**
     * Listeners to be executed on the {@code versionchange} event.
     *
     * @type {Set<function(number)>}
     */
    this[FIELDS.versionChangeListeners] = new Set()

    database.onversionchange = (event) => {
      let newVersion = event.newVersion

      this[FIELDS.versionChangeListeners].forEach((listener) => {
        try {
          listener(newVersion)
        } catch (error) {
          console.error("An event listener threw an error", error)
        }
      })
    }

    this.addVersionChangeListener(() => {
      if (this[FIELDS.versionChangeListeners].size !== 1) {
        return
      }

      console.warn("The database just received a versionchange event, but " +
          "no custom event listener has been registered for this event. " +
          "The connection to the database will therefore remain open and " +
          "the database upgrade will be blocked")
    })
  }

  /**
   * Registers the provided listener to be executed on the
   * {@code versionchange} event. The event listener will be executed with the
   * version number to which the database is being upgraded.
   *
   * It is generally recommended to close the database connection from an event
   * listener registered using this method, in order to allow the database to
   * be upgraded, and then request the user to reload the page, or perform the
   * reload automatically (while, preferably, preserving any user data).
   *
   * @param {function(number)} listener The listener to register.
   */
  addVersionChangeListener(listener) {
    this[FIELDS.versionChangeListeners].add(listener)
  }

  /**
   * Starts a new read-write transaction with the access to the specified
   * object stores.
   *
   * The created transaction will have an exclusive lock on the specified
   * object store, allowing no other, read-only or read-write, transaction to
   * access any of them until this transaction is finished. Any transaction
   * created after this one with access to any of the same object stores will
   * queue its operations and wait for this transaction to finish.
   *
   * A transaction is considered finished once it has been aborted, failed due
   * to an error, or committed. The transaction is committed automatically once
   * there are no pending requests to be fulfilled.
   *
   * The details of the transaction life cycle are available at
   * http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime.
   *
   * @param {...string} objectStoreNames The names of the object stores the
   *        created transaction should have access to.
   * @return {Transaction} The created transaction.
   * @see http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime
   */
  startTransaction(...objectStoreNames) {
    let nativeTransaction = this[FIELDS.database].transaction(
      objectStoreNames,
      TRANSACTION_MODES.READ_WRITE
    )

    return new Transaction(nativeTransaction, (objectStoreName) => {
      return this.startReadOnlyTransaction(objectStoreName)
    })
  }

  /**
   * Starts a new read-only transaction with the access to the specified object
   * stores.
   *
   * The created transaction will have a shared lock on the specified object
   * store, allowing other read-only transaction to access the same object
   * stores simultaneously, but blocking any ready-write transaction with
   * access to any object store until this transaction is finished.
   *
   * A transaction is considered finished once it has been aborted, failed due
   * to an error, or ended. The transaction is ended automatically once there
   * are no pending requests to be fulfilled.
   *
   * The details of the transaction life cycle are available at
   * http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime.
   *
   * @param {...string} objectStoreNames The names of the object stores the
   *        created transaction should have access to.
   * @return {ReadOnlyTransaction} The created transaction.
   * @see http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime
   */
  startReadOnlyTransaction(...objectStoreNames) {
    let nativeTransaction = this[FIELDS.database].transaction(
      objectStoreNames,
      TRANSACTION_MODES.READ_ONLY
    )

    return new ReadOnlyTransaction(nativeTransaction, (objectStoreName) => {
      return this.startReadOnlyTransaction(objectStoreName)
    })
  }

  /**
   * Creates a new read-only transaction with access only to the specified
   * object store and returns the object store access object.
   *
   * The object store accessor will be available for use only as long as the
   * created transaction is active.
   *
   * @param {ReadOnlyObjectStore} A read-only access to the specified object
   *        store using a new read-only transaction.
   * @see startReadOnlyTransaction(...objectStoreNames)
   */
  getObjectStore(objectStoreName) {
    let transaction = this.startReadOnlyTransaction(objectStoreName)
    return transaction.getObjectStore(objectStoreName)
  }

  /**
   * Closes this connection to the database.
   *
   * The connection is closed asynchronously, but no more operations can be
   * made using this connection once this method is called.
   */
  close() {
    this[FIELDS.database].close()
  }
}
