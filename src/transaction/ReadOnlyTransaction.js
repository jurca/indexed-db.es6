
import ReadOnlyObjectStore from "../object-store/ReadOnlyObjectStore"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  transaction: Symbol("transaction"),
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
   */
  constructor(transaction) {
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
        reject(new Error("The transaction has been aborted"))
      })
      this.addErrorListener(reject)
    })

    transaction.oncomplete = () => {
      executeEventListeners(this[FIELDS.completeListeners])
    }

    transaction.onabort = () => {
      executeEventListeners(this[FIELDS.abortListeners])
    }

    transaction.onerror = () => {
      executeEventListeners(this[FIELDS.errorListeners], transaction.error)
    }

    this.addErrorListener((error) => {
      if (this[FIELDS.errorListeners].length < 2) {
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
   * @param {function()} listener The listener to register.
   */
  addCompleteListener(listener) {
    addListener(this[FIELDS.completeListeners], listener)
  }

  /**
   * Registers the provided listener to be executed when the transaction is
   * aborted by calling the {@codelink abort()} method, or due to an error.
   *
   * The order in which the event listeners will be executed is undefined and
   * should not be relied upon.
   *
   * @param {function()} listener The listener to register.
   */
  addAbortListener(listener) {
    addListener(this[FIELDS.abortListeners], listener)
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
   * @param {function(Error)} listener The listener to register.
   */
  addErrorListener(listener) {
    addListener(this[FIELDS.errorListeners], listener)
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

    let idbObjectStore = this[FIELDS.transaction].objectStore(objectStoreName)
    let objectStore = new ReadOnlyObjectStore(idbObjectStore)
    this[FIELDS.objectStores].set(objectStoreName, objectStore)

    return objectStore
  }
}

/**
 * Adds the provided listener to the specified array of listeners. The listener
 * is added only if the array does not contain the listener already.
 *
 * @param {function(...*)[]} listeners The array of listeners to which the
 *        listener should be added.
 * @param {function(...*)} listener The listener to add to the array of
 *        listeners.
 */
function addListener(listeners, listener) {
  listeners.add(listener)
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
