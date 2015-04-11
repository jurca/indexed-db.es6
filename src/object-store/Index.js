
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
   * @override
   * @param {?(IDBKeyRange)} keyRange A key range to use to filter the records
   *        by matching the values of their primary keys against this key
   *        range.
   * @param {CursorDirection} direction The direction in which the cursor will
   *        traverse the records.
   * @param {boolean=} unique When {@code true}, it cursor will skip over the
   *        records stored with the same index key value. Defaults to
   *        {@code false}.
   * @return {Promise<Cursor>} A promise that resolves to a cursor pointing to
   *         the first matched record.
   */
  openCursor(keyRange = undefined, direction = CursorDirection.NEXT,
      unique = false) {
    return super.openCursor(keyRange, direction, unique)
  }
}
