
let nativeIndexedDB = typeof indexedDB !== "undefined" ? indexedDB : null

/**
 * The NativeDBAccessor serves as a registry for the current IndexedDB
 * implementation to use by indexed-db.es6. The task is handled by this class
 * because some browsers do not allow overriding the {@code window.indexedDB}
 * implementation with a custom one, thus preventing a shim from fixing the
 * issues in the native implementation.
 */
export default class NativeDBAccessor {
  /**
   * Throws an error, this class is static.
   */
  constructor() {
    throw new Error("The native DB accessor class is static")
  }

  /**
   * Returns the current IndexedDB implementation to use.
   *
   * @return {IDBFactory} The native IndexedDB implementation to use.
   */
  static get indexedDB() {
    return nativeIndexedDB
  }

  /**
   * Sets the IndexedDB implementation to use.
   *
   * @param {IDBFactory} newIndexedDBImplementation The new IndexedDB
   *        implementation to use.
   */
  static set indexedDB(newIndexedDBImplementation) {
    nativeIndexedDB = newIndexedDBImplementation
  }
}

/**
 * Returns the current IndexedDB implementation to use.
 *
 * @return {IDBFactory} The current IndexedDB implementation to use.
 */
export function idbProvider() {
  return NativeDBAccessor.indexedDB
}
