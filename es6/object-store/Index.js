
import ReadOnlyIndex from "./ReadOnlyIndex"
import Cursor from "./Cursor"
import CursorDirection from "./CursorDirection"

/**
 * Read-write accessor to an index.
 */
export default class Index extends ReadOnlyIndex {
  /**
   * Initializes the read-write index.
   *
   * @param {IDBIndex} storage The native Indexed DB index.
   * @param {function(): ReadOnlyTransaction} transactionFactory A function
   *        that creates and returns a new read-only transaction each time it
   *        is invoked.
   */
  constructor(storage, transactionFactory) {
    let storageFactory = () => {
      let transaction = transactionFactory()
      let objectStore = transaction.getObjectStore(storage.objectStore.name)
      return objectStore.index(storage.name)
    }
    super(storage, Cursor, storageFactory)

    Object.freeze(this)
  }

  /**
   * Opens a read-write cursor that traverses the records of this index,
   * resolving to the traversed records.
   *
   * The returned promise resolves once the record callback does not invoke
   * the {@code continue} nor the {@code advance} method synchronously or the
   * cursor reaches the end of available records.
   *
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {(CursorDirection|string)} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {boolean} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @param {function(ReadOnlyCursor)} recordCallback A callback executed every
   *        time the cursor traverses to a record.
   * @return {PromiseSync<number>} A promise that resolves to the number of
   *         iterations the cursor has made (this may be larger than the number
   *         of records traversed if the index has its {@code multiEntry} flag
   *         set and some records repeatedly appear).
   */
  openCursor(keyRange, direction, unique, recordCallback) {
    return super.openCursor(keyRange, direction, unique, recordCallback)
  }
  
  /**
   * Creates a factory function for opening cursors on this storage with the
   * specified configuration for the duration of the current transaction.
   * 
   * @override
   * @param {?(undefined|number|string|Date|Array|IDBKeyRange)=} keyRange A key
   *        range to use to filter the records by matching the values of their
   *        primary keys against this key range.
   * @param {(CursorDirection|string)=} direction The direction in which the
   *        cursor will traverse the records. Use either the
   *        {@code CursorDirection.*} constants, or strings {@code "NEXT"} and
   *        {@code "PREVIOUS"} (or {@code "PREV"} for short). The letter case
   *        used in the strings does not matter.
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value.
   * @return {function(Cursor): PromiseSync<number>} A cursor factory.
   *         The factory accepts a callback to execute on every record the
   *         cursor iterates over. The promise returned by the factory resolves
   *         once the record callback does not invoke the {@code continue} nor
   *         the {@code advance} method synchronously or the cursor reaches the
   *         end of available records.
   */
  createCursorFactory(keyRange = undefined, direction = CursorDirection.NEXT,
      unique = false) {
    return super.createCursorFactory(keyRange, direction, unique)
  }
}
