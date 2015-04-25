
/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  pendingRequests: Symbol("pendingRequests"),
  onNoPendingRequests: Symbol("onNoPendingRequests")
})

/**
 * Utility for keeping tracking of pending Indexed DB requests within a single
 * transaction.
 */
export default class RequestMonitor {
  /**
   * Initializes the request monitor.
   * 
   * @param {function(IDBRequest, boolean)} onNoPendingRequests A callback to
   *        execute every time the last pending Indexed DB request known to
   *        this monitor is completed.
   *        The callback is executed synchronously with the last completed
   *        request as the first parameters, and a flag signalling whether the
   *        request was completed without an error.
   */
  constructor(onNoPendingRequests) {
    /**
     * Storage of known pending Indexed DB requests.
     * 
     * @type {Set<IDBRequest>}
     */
    this[FIELDS.pendingRequests] = new Set()
    
    /**
     * Callback executed every time the last pending Indexed DB request known
     * to this monitor is completed.
     * 
     * The callback is executed with the last completed request as the first
     * parameters, and a flag signalling whether the request was completed
     * without an error.
     * 
     * The callback is always executed synchronously from the request's success
     * or error callback.
     * 
     * @type {function(IDBRequest, boolean)}
     */
    this[FIELDS.onNoPendingRequests] = onNoPendingRequests
    
    Object.freeze(this)
  }
  
  /**
   * Starts monitoring the provided request for completion. The request must
   * not be completed yet.
   * 
   * @param {IDBRequest} request The Indexed DB request to monitor.
   * @return {Promise<*>} A promise that is resolved or rejected when the
   *         provided Indexed DB request is completed. The promise resolves to
   *         the request's result.
   */
  monitor(request) {
    this[FIELDS.pendingRequests].add(request)
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
        onRequestFinished(true)
      }
      request.onerror = () => {
        reject(request.error)
        onRequestFinished(false)
      }
    })
    
    function onRequestFinished(wasSuccessful) {
      this[FIELDS.pendingRequests].delete(request)
      
      if (!this[FIELDS.pendingRequests].size) {
        this[FIELDS.onNoPendingRequests](request, wasSuccessful)
      }
    }
  }
}
