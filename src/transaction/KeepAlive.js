
import RequestMonitor from "./RequestMonitor"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  requestMonitor: Symbol("requestMonitor"),
  keepAliveObjectStoreFactory: Symbol("keepAliveObjectStoreFactory"),
  commitDelay: Symbol("commitDelay"),
  lastClientRequest: Symbol("lastClientRequest"),
  lastKeepAliveRequest: Symbol("lastKeepAliveRequest"),
  terminated: Symbol("terminated")
})

/**
 * Utility for keeping the current transaction alive even after the last
 * client-created operation request for a configurable period of time.
 */
export default class KeepAlive {
  /**
   * Initializes the Keep Alive.
   * 
   * @param {function(): IDBObjectStore} keepAliveObjectStoreFactory A callback
   *        that produces the same native Indexed DB object store within the
   *        current transaction every time it is called.
   * @param {number} commitDelay The number of milliseconds the current
   *        transaction should be kept alive since the last client-triggered
   *        operation has been completed.
   */
  constructor(keepAliveObjectStoreFactory, commitDelay) {
    /**
     * A callback that produces the same native Indexed DB object store within
     * the current transaction every time it is called.
     * 
     * The returned object store is used to create the keep-alive Indexed DB
     * requests.
     * 
     * @type {function(): IDBObjectStore}
     */
    this[FIELDS.keepAliveObjectStoreFactory] = keepAliveObjectStoreFactory
    
    /**
     * The number of milliseconds the Keep Alive should keep the current
     * transaction alive since the last Indexed DB request that was not created
     * by this Keep Alive has been completed.
     * 
     * This Keep Alive no longer creates new keep-alive Indexed DB requests in
     * the current transaction after this period is expired.
     * 
     * @type {number}
     */
    this[FIELDS.commitDelay] = commitDelay
    
    /**
     * The UNIX timestamp with millisecond precission since the last remaining
     * pending Indexed DB request that was not created by this Keep Alive has
     * been completed.
     * 
     * @type {number}
     */
    this[FIELDS.lastClientRequest] = 0
    
    /**
     * The last keep-alive Indexed DB request created.
     * 
     * @type {?IDBRequest}
     */
    this[FIELDS.lastKeepAliveRequest] = null
    
    /**
     * Flag signalling whether the keep-alive process for the current
     * transaction has not been terminated manually. If {@code true}, the Keep
     * Alive will no longer create new keep-alive Indexed DB requests to keep
     * the current transaction alvie.
     * 
     * @type {boolean}
     */
    this[FIELDS.terminated] = false
    
    /**
     * The request monitor monitoring the pending Indexed DB request in the
     * current transaction.
     * 
     * @type {RequestMonitor}
     */
    this[FIELDS.requestMonitor] = new RequestMonitor((request, success) => {
      if (this[FIELDS.terminated]) {
        // the keep-alive has been terminated, let the transaction be commited
        // right away
        return
      }
      
      if (!success) {
        return // the transaction is going to be rolled back
      }
      
      if (request !== this[FIELDS.lastKeepAliveRequest]) {
        this[FIELDS.lastClientRequest] = Date.now()
      }
      
      let sinceLastClientRequest = Date.now() - this[FIELDS.lastClientRequest]
      if (sinceLastClientRequest > this[FIELDS.commitDelay]) {
        return // let the transaction commit
      }
      
      let objectStore = keepAliveObjectStoreFactory()
      this[FIELDS.lastKeepAliveRequest] = objectStore.get(0)
      this[FIELDS.requestMonitor].monitor(this[FIELDS.lastKeepAliveRequest])
    })
  }
  
  /**
   * Returns the request monitor used by this Keep Alive to track the pending
   * Indexed DB requests in this transaction.
   * 
   * Register all custom requests with the returned monitor to ensure the Keep
   * Alive will function properly.
   * 
   * @return {RequestMonitor} The request monitor used by this Keep Alive to
   *         track the pending Indexed DB requests in this transaction.
   */
  get requestMonitor() {
    return this[FIELDS.requestMonitor]
  }

  /**
   * Prevents further keep-alive Indexed DB requests be created in the current
   * transaction.
   * 
   * The method has no effect if called repeatedly.
   */
  terminate() {
    this[FIELDS.terminated] = true
  }
}
