
/**
 * Possible states of the promise
 */
const STATE = Object.freeze({
  PENDING: Object.freeze({}),
  RESOLVED: Object.freeze({}),
  REJECTED: Object.freeze({})
})

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  state: Symbol("state"),
  value: Symbol("value"),
  fulfillListeners: Symbol("fulfillListeners"),
  errorListeners: Symbol("errorListeners")
})

/**
 * The {@codelink PromiseSync} is a synchronous alternative to the Promise/A+
 * API, meaning that all callbacks are executed synchronously.
 * 
 * The synchronous promise is used for in-transaction operations to ensure the
 * following:
 * - It allows safe wrapping of IndexedDB request objects, allowing the
 *   callbacks to request more operations on the transaction without the risk
 *   of the transaction becoming inactive. Promise/A+ callbacks are executed
 *   asynchronously, so the transaction will be marked as inactive before the
 *   {@code then} callback of an Promise/A+-wrapped request would be executed.
 * - Firefox (37, and probably later versions too) does not allow the
 *   Promise/A+ callbacks to request new opersions on the transaction even if
 *   the transaction is still alive (it throws an error claiming the
 *   transaction is inactive).
 * 
 * Since safe wrapping of IndexedDB requests is the main use of the
 * {@codelink PromiseSync} promises, the {@codelink PromiseSync.resolve()}
 * method can handle {@codelink IDBRequest} instances as an argument.
 */
export default class PromiseSync {
  /**
   * Initializes the synchronous promise.
   * 
   * @param {function(function(*), function(Error))} callback The promise
   *        initialization callback.
   */
  constructor(callback) {
    /**
     * One of the {@code STATE.*} constants representing the current state of
     * this promise.
     * 
     * @type {Object}
     */
    this[FIELDS.state] = STATE.PENDING
    
    /**
     * The result value of this promise.
     * 
     * @type {(undefined|*|Error)}
     */
    this[FIELDS.value] = undefined
    
    /**
     * Internal listeners used to notify the descending promises when this
     * promise is asynchronously fulfilled.
     * 
     * @type {function()[]}
     */
    this[FIELDS.fulfillListeners] = []
    
    /**
     * Internal listeners used to notify the descending promises when this
     * promise is asynchronously rejected.
     * 
     * @type {function()[]}
     */
    this[FIELDS.errorListeners] = [
      () => {
        if (this[FIELDS.errorListeners] === 1) {
          console.error("Uncaught (in sync promise)", this[FIELDS.value])
        }
      }
    ]
    
    try {
      callback(
        value => resolve(this, STATE.RESOLVED, value),
        error => resolve(this, STATE.REJECTED, error)
      )
    } catch (error) {
      resolve(this, STATE.REJECTED, error)
    }
  }
  
  /**
   * Registers the provided success and error callbacks on this promise.
   * 
   * If this promise resolves, the success callback will be triggered. The
   * value returned by the success callback will be the value of the promise
   * returned by this method. However, if the value returned by the callback is
   * a {@codelink PromiseSync} instance, the promise returned by this method
   * will resolve to the result of the promise returned by the callback.
   * Finally, if the callback throws an error, the promise returned by this
   * method will be rejected by the error thrown by the callback.
   * 
   * If this promise rejects, the error callback will be triggered. The error
   * callback affects the resolution/rejection of the promise returned by this
   * method in the same way the success callback does.
   * 
   * @param {function(*): *} onFulfill The success callback.
   * @param {function(Error): *} onError The error callback.
   * @return {PromiseSync} A promise resolved when this promise is resolved and
   *         the return value of the invoked callback is resolved.
   */
  then(onFulfill, onError = undefined) {
    let thisPromise = this
    
    return new PromiseSync((resolve, reject) => {
      switch (this[FIELDS.state]) {
        case STATE.PENDING:
          this[FIELDS.fulfillListeners].push(() => handleResolution(onFulfill))
          this[FIELDS.errorListeners].push(() => handleResolution(onError))
          break
        case STATE.RESOLVED:
          handleResolution(onFulfill)
          break
        case STATE.REJECTED:
          handleResolution(onError)
          break
      }
      
      function handleResolution(callback) {
        if (!(callback instanceof Function)) {
          if (thisPromise[FIELDS.state] === STATE.RESOLVED) {
            resolve(thisPromise[FIELDS.value])
          } else {
            reject(thisPromise[FIELDS.value])
          }
        }
        
        try {
          let newValue = callback(thisPromise[FIELDS.value])
          if (newValue instanceof PromiseSync) {
            newValue.then(
              resultingValue => resolve(resultingValue),
              error => reject(error)
            )
          } else {
            resolve(newValue)
          }
        } catch (error) {
          reject(error)
        }
      }
    })
  }
  
  /**
   * Returns a new promise that executes the provided callback if this promise
   * gets rejected, passing the error as the argument to the callback.
   * 
   * The returned promise will resolve if this promise resolves.
   * 
   * This method is essentially a shorthand for
   * {@code promise.then(undefined, onError)}.
   * 
   * @param {function(Error): *} onError The callback to execute if this
   *        promise is rejected. The callback may either return a value to
   *        resolve the returned promise, or throw an error to reject it.
   * @return {PromiseSync<*>} A promise resolved when this promise is resolved
   *         or the provided callback returns a value, and rejected if this
   *         promise is rejected and the callback throws an error.
   */
  catch(onError) {
    return this.then(undefined, onError)
  }
  
  /**
   * Converts this promise to a regular Promise/A+ native promise.
   * 
   * @return {Promise<*>} Asynchronous representation of this promise.
   */
  toPromise() {
    return new Promise((resolve, reject) => {
      this.then(resolve, reject)
    })
  }
  
  /**
   * Creates a new promise that resolves to the provided value.
   * 
   * If the value is a {@codelink Promise} or a {@codelink PromiseSync}
   * instance, the returned promise will be resolved when the provided promise
   * is resolved, and rejected if the provided promise is rejected.
   * 
   * If the value is a {@codelink IDBRequest} instance, the returned promise
   * will resolve when the request's {@code onsuccess} method is triggered, and
   * rejects when the request's {@code onerror} method is triggered. 
   * 
   * Note that the method returns the provided value if the value is a
   * {@codelink PromiseSync} instance.
   * 
   * Also, if an already completed Indexed DB request is provided, the returned
   * promise will never resolve. The method replaces any value previously set
   * to the request's {@code onsuccess} and {@code onerror} methods.
   * 
   * @param {(Promise<*>|PromiseSync<*>|IDBRequest<*>|*)} value The value to
   *        which the returned promise should be resolved.
   * @return {PromiseSync<*>} A promise that resolves to the provided value, or
   *         the value to which the provided promise or Indexed DB request
   *         resolves.
   */
  static resolve(value) {
    if (value instanceof PromiseSync) {
      return value
    }
    
    if (value instanceof Promise) {
      return new PromiseSync((resolve, reject) => {
        value.then(resolve, reject)
      })
    }
    
    if (value instanceof IDBRequest) {
      return new PromiseSync((resolve, reject) => {
        value.onsuccess = () => resolve(value.result)
        value.onerror = () => reject(value.error)
      })
    }
    
    return new PromiseSync((resolve) => {
      resolve(value)
    })
  }
  
  /**
   * Creates a new promise that is rejected with the provided error.
   * 
   * @param {Error} error The error.
   * @return {PromiseSync} A new promise rejected with the provided error.
   */
  static reject(error) {
    return new PromiseSync(() => {
      throw error
    })
  }
  
  /**
   * Returns a new promise that resolves once all the provided promises
   * resolve, or rejects if any of the promises rejects.
   * 
   * The returned promise resolves to an array of values provided by the
   * resolved promises.
   * 
   * @param {(PromiseSync<*>|Promise<*>)[]} promises The promises to resolve.
   * @return {PromiseSync} A promise that resolves when all of the provided
   *         promises resolve.
   */
  static all(promises) {
    return new PromiseSync((resolve, reject) => {
      let state = []
      for (let promise of promises) {
        let promiseState = {
          resolved: false,
          result: undefined
        }
        state.push(promiseState)
        
        promise.then((result) => {
          promiseState.result = result
          promiseState.resolved = true
          
          checkState()
        })
        
        promise.catch((error) => {
          reject(error)
        })
      }
      
      function checkState() {
        if (state.every(promiseState => promiseState.resolved)) {
          resolve(state.map(promiseState => promiseState.result))
        }
      }
    })
  }
  
  /**
   * Returns a new promise that resolves to the value or error provided by the
   * promise that resolved as first from the provided promises.
   * 
   * @param {(PromiseSync<*>|Promise<*>)[]} promises The promises that should
   *        race among each other.
   * @return {PromiseSync<*>} A promise resolved when one of the promises
   *         resolves. The promise will resolve to the result of the promise
   *         that resolved as first.
   */
  static race(promises) {
    return new PromiseSync((resolve, reject) => {
      for (let promise of promises) {
        promise.then(resolve, reject)
      }
    })
  }
}

/**
 * Resolves the provided promise to the specified state and result value. This
 * function has no effect if the provided promise has already been resolved.
 * 
 * @param {PromiseSync} instance The promise to resolve.
 * @param {Object} newState One of the {@code STATE.*} constants representing
 *        the new state of the promise. Must not be {@code STATE.PENDING}.
 * @param {(*|Error)} value The new result value of the promise.
 */
function resolve(instance, newState, value) {
  if (instance[FIELDS.state] !== STATE.PENDING) {
    return
  }
  
  instance[FIELDS.state] = newState
  instance[FIELDS.value] = value
  
  let listeners
  if (newState === STATE.RESOLVED) {
    listeners = instance[FIELDS.fulfillListeners]
  } else {
    listeners = instance[FIELDS.errorListeners]
  }
  
  for (let listener of listeners) {
    listener()
  }
}
