
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
  versionChangeListeners: Symbol("versionChangeListeners"),
  activeTransactions: Symbol("activeTransactions")
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
        Object.freeze(Array.from(database.objectStoreNames))

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
    
    /**
     * The transactions that currently are in progress.
     * 
     * @type {Set<ReadOnlyTransaction>}
     */
    this[FIELDS.activeTransactions] = new Set()

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
   * http://www.w3.org/TR/IndexedDB/#dfn-transaction-lifetime.
   *
   * @param {(...string|string[])} objectStoreNames The names of the object
   *        stores the created transaction should have access to.
   * @return {Transaction} The created transaction.
   * @see http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime
   */
  startTransaction(...objectStoreNames) {
    if (objectStoreNames[0] instanceof Array) {
      objectStoreNames = objectStoreNames[0]
    }
    
    let nativeTransaction = this[FIELDS.database].transaction(
      objectStoreNames,
      TRANSACTION_MODES.READ_WRITE
    )
    
    let transaction = new Transaction(nativeTransaction, (objectStoreName) => {
      return this.startReadOnlyTransaction(objectStoreName)
    })
    
    this[FIELDS.activeTransactions].add(transaction)
    transaction.completionPromise.catch(() => {}).then(() => {
      this[FIELDS.activeTransactions].delete(transaction)
    })
    
    return transaction
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
   * http://www.w3.org/TR/IndexedDB/#dfn-transaction-lifetime.
   *
   * @param {(...string|string[])} objectStoreNames The names of the object
   *        stores the created transaction should have access to.
   * @return {ReadOnlyTransaction} The created transaction.
   * @see http://w3c.github.io/IndexedDB/#dfn-transaction-lifetime
   */
  startReadOnlyTransaction(...objectStoreNames) {
    if (objectStoreNames[0] instanceof Array) {
      objectStoreNames = objectStoreNames[0]
    }
    
    let nativeTransaction = this[FIELDS.database].transaction(
      objectStoreNames,
      TRANSACTION_MODES.READ_ONLY
    )
    
    let transaction = new ReadOnlyTransaction(nativeTransaction,
        (objectStoreName) => {
      return this.startReadOnlyTransaction(objectStoreName)
    })
    
    this[FIELDS.activeTransactions].add(transaction)
    transaction.completionPromise.catch(() => {}).then(() => {
      this[FIELDS.activeTransactions].delete(transaction)
    })
    
    return transaction
  }

  /**
   * Creates a new read-only transaction with access only to the specified
   * object store and returns the object store access object.
   *
   * The object store accessor will be available for use only as long as the
   * created transaction is active.
   *
   * @param {string} objectStoreName The name of the object store.
   * @return {ReadOnlyObjectStore} A read-only access to the specified object
   *        store using a new read-only transaction.
   * @see startReadOnlyTransaction(...objectStoreNames)
   */
  getObjectStore(objectStoreName) {
    let transaction = this.startReadOnlyTransaction(objectStoreName)
    return transaction.getObjectStore(objectStoreName)
  }
  
  /**
   * Runs the provided transaction operations on the specified object stores
   * in a new read-write transaction.
   * 
   * The created transaction will have an exclusive lock on the specified
   * object store, allowing no other, read-only or read-write, transaction to
   * access any of them until this transaction is finished. Any transaction
   * created after this one with access to any of the same object stores will
   * queue its operations and wait for this transaction to finish.
   * 
   * The method returns a promise resolved when the transaction completes.
   * 
   * @param {string|string[]} objectStoreNames The name(s) of the object stores
   *        to pass to the {@linkcode transactionOperations} callback, or an
   *        array containing a single item - the array of object store names.
   *        It is possible to use a string if only a single object store is
   *        needed.
   * @param {function(...ObjectStore, function()): PromiseSync<*>} transactionOperations
   *        The callback containing the operations on the object stores in the
   *        transaction.
   *        The callback will receive the requested object stores as arguments,
   *        followed by a callback for aborting the transaction.
   *        The callback should return a synchronous promise (a return value of
   *        one of the data-related methods of object stores and their
   *        indexes), the value to which the returned promise resolves will be
   *        the result value of the promise returned by this function.
   * @return {Promise<*>} A promise that resolves when the transaction is
   *         completed. The promise will resolve to the value to which resolved
   *         the promise returned by the {@linkcode transactionOperations}
   *         callback.
   */
  runTransaction(objectStoreNames, transactionOperations) {
    if (typeof objectStoreNames === "string") {
      objectStoreNames = [objectStoreNames]
    }
    
    let transaction = this.startTransaction(...objectStoreNames)
    return runTransaction(transaction, objectStoreNames, transactionOperations)
  }
  
  /**
   * Runs the provided transaction operations on the specified object stores
   * in a new read-only transaction.
   * 
   * The created transaction will have a shared lock on the specified object
   * store, allowing other read-only transaction to access the same object
   * stores simultaneously, but blocking any ready-write transaction with
   * access to any object store until this transaction is finished.
   * 
   * The method returns a promise resolved when the transaction completes.
   * 
   * @param {string|string[]} objectStoreNames The name(s) of the object stores
   *        to pass to the {@linkcode transactionOperations} callback, or an
   *        array containing a single item - the array of object store names.
   *        It is possible to use a string if only a single object store is
   *        needed.
   * @param {function(...ReadOnlyObjectStore, function()): PromiseSync<*>} transactionOperations
   *        The callback containing the operations on the object stores in the
   *        transaction.
   *        The callback will receive the requested object stores as arguments,
   *        followed by a callback for aborting the transaction.
   *        The callback should return a synchronous promise (a return value of
   *        one of the data-related methods of object stores and their
   *        indexes), the value to which the returned promise resolves will be
   *        the result value of the promise returned by this function.
   * @return {Promise<*>} A promise that resolves when the transaction is
   *         completed. The promise will resolve to the value to which resolved
   *         the promise returned by the {@linkcode transactionOperations}
   *         callback.
   */
  runReadOnlyTransaction(objectStoreNames, transactionOperations) {
    if (typeof objectStoreNames === "string") {
      objectStoreNames = [objectStoreNames]
    }
    
    let transaction = this.startReadOnlyTransaction(...objectStoreNames)
    return runTransaction(transaction, objectStoreNames, transactionOperations)
  }

  /**
   * Closes this connection to the database.
   *
   * The connection is closed asynchronously, but no more operations can be
   * made using this connection once this method is called, even using the
   * still active transactions.
   * 
   * The promise returned by this method resolves once all pending transactions
   * started from this connection are completed (the connection is not actually
   * closed until all pending transactions are completed).
   * 
   * Note that any pending {@code versionchange} transactions (database schema
   * upgrades or database deletions) will not happen until the connection is
   * actually closed (after the returned promise returns).
   * 
   * @return {Promise<undefined>} A promise resolved when all pending
   *         transactions are completed.
   */
  close() {
    this[FIELDS.database].close()
    
    let transactions = Array.from(this[FIELDS.activeTransactions])
    return Promise.all(transactions.map((transaction) => {
      return transaction.completionPromise
    })).catch(() => {}).then(() => {})
  }
}

/**
 * Runs the provided transaction operations on the specified object stores
 * obtained from the provided transaction.
 * 
 * The function returns a promise resolved when the transaction completes.
 * 
 * @param {ReadOnlyTransaction} transaction The transaction from which the
 *        object stores will be retrieved. The returned promise will resolve
 *        when this transaction is completed.
 * @param {string[]} objectStoreNames The names of the object stores to pass to the
 *        {@linkcode transactionOperations} callback.
 * @param {function(...ReadOnlyObjectStore, function()): PromiseSync<*>} transactionOperations
 *        The callback containing the operations on the object stores in the
 *        transaction.
 *        The callback will receive the requested object stores as arguments,
 *        followed by a callback for aborting the transaction.
 *        The callback should return a synchronous promise (a return value of
 *        one of the data-related methods of object stores and their indexes),
 *        the value to which the returned promise resolves will be the result
 *        value of the promise returned by this function.
 * @return {Promise<*>} A promise that resolves when the transaction is
 *         completed. The promise will resolve to the value to which resolved
 *         the promise returned by the {@linkcode transactionOperations}
 *         callback.
 */
function runTransaction(transaction, objectStoreNames, transactionOperations) {
  let callbackArguments = objectStoreNames.map((objectStoreName) => {
    return transaction.getObjectStore(objectStoreName)
  })
  callbackArguments.push(() => transaction.abort())
  
  let resultPromise = transactionOperations(...callbackArguments)
  return Promise.resolve(resultPromise).then((result) => {
    return transaction.completionPromise.then(() => result)
  })
}
