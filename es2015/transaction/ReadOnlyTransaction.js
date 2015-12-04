
import ReadOnlyObjectStore from "../object-store/ReadOnlyObjectStore"
import ReadOnlyCursor from "../object-store/ReadOnlyCursor"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  transaction: Symbol("transaction"),
  transactionFactory: Symbol("transactionFactory"),
  objectStores: Symbol("objectStores"),
  completeListeners: Symbol("completeListeners"),
  abortListeners: Symbol("abortListeners"),
  errorListeners: Symbol("errorListeners")
})

/**
 * A transaction with only a read-only access to the selected object stores.
 */
export default class ReadOnlyTransaction {
  /**
   * Initializes the read-only transaction.
   *
   * @param {IDBTransaction} transaction The IndexedDB native transaction.
   * @param {function(string): ReadOnlyTransaction} transactionFactory The
   *        factory function that creates a new read-only transaction with
   *        access only the to the object store specified by the provided
   *        argument every time the function is invoked.
   */
  constructor(transaction, transactionFactory) {
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
     * @type {Map<string, ReadOnlyObjectStore>}
     */
    this[FIELDS.objectStores] = new Map()

    /**
     * Event listeners for the {@code complete} event.
     *
     * @type {Set<function()>}
     */
    this[FIELDS.completeListeners] = new Set()

    /**
     * Event listeners for the {@code abort} event.
     *
     * @type {Set<function()>}
     */
    this[FIELDS.abortListeners] = new Set()

    /**
     * Event listeners of the {@code error} event.
     *
     * @type {Set<function(Error)>}
     */
    this[FIELDS.errorListeners] = new Set()

    /**
     * A promise that resolves when the transaction is completed, and rejects
     * when it is aborted on encounters an unexpected error.
     *
     * @type {Promise<undefined>}
     */
    this.completionPromise = new Promise((resolve, reject) => {
      this.addCompleteListener(resolve)
      this.addAbortListener(() => {
        let abortError = new Error("The transaction has been aborted")
        abortError.name = "AbortError"
        reject(abortError)
      })
      this.addErrorListener(reject)
    })

    transaction.oncomplete = () => {
      executeEventListeners(this[FIELDS.completeListeners])
    }

    transaction.onabort = () => {
      executeEventListeners(this[FIELDS.abortListeners])
    }

    transaction.onerror = (event) => {
      executeEventListeners(this[FIELDS.errorListeners], transaction.error)
      event.preventDefault()
    }

    this.addErrorListener((error) => {
      if (this[FIELDS.errorListeners].size < 2) {
        console.error("Encountered an uncaptured transaction-level error " +
            "while no error listeners were registered", error);
      }
    })

    if (this.constructor === ReadOnlyTransaction) {
      Object.freeze(this)
    }
  }

  /**
   * Registers the provided listener to be executed when the transaction is
   * completed.
   *
   * The order in which the event listeners will be executed is undefined and
   * should not be relied upon.
   * 
   * This method provides a more low-level access to the transaction lifecycle
   * which can be useful in certain situations, however, it is recommended to
   * use the {@linkcode completionPromise} instead as it makes promise chaining
   * easier.
   *
   * @param {function()} listener The listener to register.
   */
  addCompleteListener(listener) {
    this[FIELDS.completeListeners].add(listener)
  }

  /**
   * Registers the provided listener to be executed when the transaction is
   * aborted by calling the {@linkcode abort()} method, or due to an error.
   *
   * The order in which the event listeners will be executed is undefined and
   * should not be relied upon.
   * 
   * This method provides a more low-level access to the transaction lifecycle
   * which can be useful in certain situations, however, it is recommended to
   * use the {@linkcode completionPromise} instead as it makes promise chaining
   * easier.
   *
   * @param {function()} listener The listener to register.
   */
  addAbortListener(listener) {
    this[FIELDS.abortListeners].add(listener)
  }

  /**
   * Registers the provided listener to be executed when an error is
   * encountered during the manipulation of the database from this transaction,
   * and the error was not somehow captured during the processing of the
   * operation that caused the error.
   *
   * The order in which the event listeners will be executed is undefined and
   * should not be relied upon.
   * 
   * This method provides a more low-level access to the transaction lifecycle
   * which can be useful in certain situations, however, it is recommended to
   * use the {@linkcode completionPromise} instead as it makes promise chaining
   * easier.
   *
   * @param {function(Error)} listener The listener to register.
   */
  addErrorListener(listener) {
    this[FIELDS.errorListeners].add(listener)
  }

  /**
   * Aborts this transaction. Calling this method will lead to the execution of
   * the abort listeners registered on this transaction.
   */
  abort() {
    this[FIELDS.transaction].abort()
  }

  /**
   * Returns the read-only object store of the specified name. The method
   * returns the same object store if called repeatedly with the same argument.
   *
   * @param {string} objectStoreName The name of the object store to retrieve.
   * @return {ReadOnlyObjectStore} The object store.
   */
  getObjectStore(objectStoreName) {
    if (this[FIELDS.objectStores].has(objectStoreName)) {
      return this[FIELDS.objectStores].get(objectStoreName)
    }

    let transactionFactory = () => {
      return this[FIELDS.transactionFactory](objectStoreName)
    }

    let idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName)
    let objectStore = new ReadOnlyObjectStore(
      idbObjectStore,
      ReadOnlyCursor,
      transactionFactory
    )
    this[FIELDS.objectStores].set(objectStoreName, objectStore)

    return objectStore
  }
}

/**
 * Executes the provided event listeners with the provided parameters. Any
 * errors thrown by the executed event listeners will be caught and logged to
 * the console, and then the remaining event listeners will be executed.
 *
 * @param {function(...*)[]} listeners The event listeners to execute.
 * @param {...*} parameters The parameters to pass to the event listeners as
 *        arguments.
 */
function executeEventListeners(listeners, ...parameters) {
  listeners.forEach((listener) => {
    try {
      listener.apply(null, parameters)
    } catch (error) {
      console.error("An event listener threw an error", error)
    }
  })
}
