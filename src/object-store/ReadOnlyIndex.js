
import AbstractReadOnlyStorage from "./AbstractReadOnlyStorage"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  storage: Symbol("storage"),
  cursorConstructor: Symbol("cursorConstructor")
})

/**
 * Read-only accessor for an index.
 */
export default class ReadOnlyIndex extends AbstractReadOnlyStorage {
  /**
   * Initializes the read-only index.
   *
   * @param {IDBIndex} storage The native Indexed DB index.
   * @param {function(this: ReadyOnlyCursor)} cursorConstructor Constructor of
   *        the cursor to use when traversing the storage records.
   * @param {function(): ReadOnlyTransaction} transactionFactory A function
   *        that creates and returns a new read-only transaction each time it
   *        is invoked.
   */
  constructor(storage, cursorConstructor, transactionFactory) {
    let storageFactory = () => {
      let transaction = transactionFactory()
      let objectStore = transaction.getObjectStore(storage.objectStore.name)
      return objectStore.index(storage.name)
    }
    super(storage, cursorConstructor, storageFactory)

    /**
     * When {@code true}, and a record's index key path evaluates to an array,
     * the index stores an index key value for each element of the evaluated
     * array.
     *
     * @type {boolean}
     */
    this.multiEntry = storage.multiEntry

    /**
     * When {@code true}, the index enforces that no records may share the same
     * index key value.
     *
     * @type {boolean}
     */
    this.unique = storage.unique

    /**
     * The native Indexed DB index.
     *
     * @type {IDBIndex}
     */
    this[FIELDS.storage] = storage

    /**
     * The constructor function of the cursor to use to create cursor
     * instances.
     *
     * @type {function(this: ReadyOnlyCursor)}
     */
    this[FIELDS.cursorConstructor] = cursorConstructor

    if (this.constructor === ReadOnlyIndex) {
      Object.freeze(this)
    }
  }

  /**
   * Retrieves the primary key of the first record matching the specified key
   * value or key range.
   *
   * @param {(number|string|Date|Array|IDBKeyRange)} key The index key or key
   *        range for which a record primary key should be retrieved.
   * @return {Promise<(undefined|number|string|Date|Array)>} A promise that
   *         resolves to the primary key of the first record matching the
   *         specified index key or key range. The promise resolves to
   *         {@code undefined} if no record is found.
   */
  getPrimaryKey(key) {
    return new Promise((resolve, reject) => {
      let request = this[FIELDS.storage].getKey(key)
      request.onsuccess = resolve(request.result)
      request.onerror = reject(request.error)
    })
  }

  /**
   * Traverses the keys in this index in the ascending order and resolves into
   * the primary keys of all traversed records.
   *
   * @return {Promise<(number|string|Date|Array)[]>} A promise that resolves to
   *         a list of all record primary keys obtained by getting the primary
   *         of records traversed by traversing the key of this index in the
   *         ascending order.
   */
  getAllPrimaryKeys() {
    let primaryKeys = [];

    return new Promise((resolve, reject) => {
      this.openKeyCursor().
          then(iterate).
          catch(reject)

      function iterate(cursor) {
        if (!cursor) {
          resolve(primaryKeys)
          return
        }

        primaryKeys.push(cursor.primaryKey)

        cursor.advance().
            then(iterate).
            catch(reject)
      }
    })
  }

  /**
   * Opens a read-only cursor that traverses the records of this index,
   * resolving to the traversed records.
   *
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the records.
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value. Defaults to
   *        {@code false}.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openCursor(keyRange = undefined, direction = CursorDirection.NEXT,
      unique = false) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    if (unique) {
      cursorDirection += "unique"
    }
    let request = this[FIELDS.storage].openCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new cursorConstructor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Opens a read-only cursor that traverses the records of this index,
   * resolving only the primary keys of the records.
   *
   * The {@code record} field of the cursor will always be {@code null}.
   *
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the records.
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value. Defaults to
   *        {@code false}.
   * @return {Promise<ReadOnlyCursor>} A promise that resolves to a cursor
   *         pointing to the first matched record.
   */
  openKeyCursor(keyRange = undefined, direction = CursorDirection.NEXT,
      unique = false) {
    if (keyRange === null) {
      keyRange = undefined
    }

    let cursorConstructor = this[FIELDS.cursorConstructor]

    let cursorDirection = direction.value.toLowerCase().substring(0, 4)
    if (unique) {
      cursorDirection += "unique"
    }
    let request = this[FIELDS.storage].openKeyCursor(keyRange, cursorDirection)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(new cursorConstructor(request))
      }
      request.onerror = () => reject(request.error)
    })
  }
}
