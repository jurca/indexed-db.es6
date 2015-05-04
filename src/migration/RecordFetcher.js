
import Database from "../Database"
import UpgradedDatabaseSchema from "../schema/UpgradedDatabaseSchema"

/**
 * Utility for fetching (and deleting) records from a database for the purpose
 * of database data migration between schema version upgrades.
 */
export default class RecordFetcher {
  /**
   * Opens a new connection to the specified database, fetches all records from
   * the specified object store, closes the connection and returns the fetched
   * records.
   * 
   * @param {string} databaseName The name of the database from which the
   *        records should be fetched. The database must exist.
   * @param {{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)}[]}
   *        objectStores Names names of object stores from which all records
   *        should be fetched and a map/filter callback functionexecuted to
   *        preprocess the records.
   *        The callback function will executed with the following arguments:
   *        - the record
   *        - the primary key of the record (will be frozen to prevent any
   *          modifications)
   * 
   *        The callback may return either the preprocessed record, or
   *        {@codelink UpgradedDatabaseSchema.SKIP_RECORD} to indicate that the
   *        record should be ommited from the records passed to the
   *        after-migration callback, or
   *        {@codelink UpgradedDatabaseSchema.DELETE_RECORD} to both omit the
   *        record from the records passed to the after-migration callback and
   *        delete the record.
   * @return {Promise<Object<string, {key: (number|string|Date|Array), record: *}[]>>}
   *         A promise that resolves to a map of object store names to the
   *         records fetched from the object store, except for the records
   *         marked for skipping or deletion.
   */
  fetchRecords(databaseName, objectStores) {
    if (!objectStores.length) {
      throw new Error("The object stores array cannot be empty")
    }
    
    let request = indexedDB.open(databaseName)
    
    let objectStoreNames = objectStores.map((descriptor) => {
      return descriptor.objectStore
    })
    
    let openedDatabase
    
    return openConnection(request, objectStoreNames).then((nativeDatabase) => {
      openedDatabase = nativeDatabase
      let database = new Database(nativeDatabase)
      return fetchAllRecords(database, objectStores).then((records) => {
        database.close()
        return records
      })
    }).catch((error) => {
      if (openedDatabase) {
        openedDatabase.close()
      }
      
      throw error
    })
  }
}

/**
 * Fetches all records from the specified object stores using the provided
 * read-write transaction.
 * 
 * @param {Database} database The connection to the database from which the
 *        records should be fetched.
 * @param {(string|{objectStore: string, preprocessor: function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)=})[]}
 *        objectStores The names of object stores that should have their
 *        records fetch or (possibley partially filled) object store fetch
 *        descriptors, mixed in an array.
 * @return {Promise<Object<string, {key: (number|string|Date|Array), record: *}[]>>}
 *         A promise that resolves once all the records have been fetched and
 *         the records marked for deletion were deleted.
 *         The promise resolves to a map of object store names to the records
 *         fetched from the object store, except for the records marked for
 *         skipping or deletion.
 */
function fetchAllRecords(database, objectStores) {
  let objectStoreNames = objectStores.map((descriptor) => {
    return descriptor.objectStore
  })
  let transaction = database.startTransaction(objectStoreNames)
  
  return Promise.all(objectStores.map((descriptor) => {
    return fetchRecords(
      transaction.getObjectStore(descriptor.objectStore),
      descriptor.preprocessor
    )
  })).then((fetchedRecords) => {
    let recordsMap = {}
    
    for (let i = 0; i < objectStores.length; i++) {
      recordsMap[objectStores[i].objectStore] = fetchedRecords[i]
    }
    
    return transaction.completionPromise.then(() => recordsMap)
  })
}

/**
 * Extracts all records from the provided object store and preprocesses them
 * using the provided preprocessor.
 * 
 * The method traverses the records of the object store in ascending order of
 * their primary keys, deleting the records for which the preprocessor returns
 * the {@codelink UpgradedDatabaseSchema.DELETE_RECORD} before traversing to
 * the next record.
 * 
 * @param {ObjectStore} objectStore The read-write accessor the object store
 *        from which the records should be read.
 * @param {function(*, (number|string|Date|Array)): (*|UpgradedDatabaseSchema.SKIP_RECORD|UpgradedDatabaseSchema.DELETE_RECORD)}
 *        preprocessor The callback to call on each record. The value retuned
 *        by it will be stored in the resulting record array instead of the
 *        original record.
 *        The record will not be included in the resulting record array if the
 *        preprocessor returns {@codelink UpgradedDatabaseSchema.SKIP_RECORD}
 *        or {@codelink UpgradedDatabaseSchema.DELETE_RECORD}.
 * @return {Promise<{key: (number|string|Date|Array), record: *}[]>} A promise
 *         that resolves once all records in the object store have been
 *         traversed. The promise will resolve to an array of the records
 *         processed by the provided record preprocessor, in the order they
 *         were traversed, and not containing the records that the preprocessor
 *         marked as to be skipped or deleted.
 */
function fetchRecords(objectStore, preprocessor) {
  return new Promise((resolve, reject) => {
    let records = []
    
    let cursorPromise = objectStore.openCursor()
    cursorPromise.
        then(iterate).
        catch(reject)
    
    function iterate(cursor) {
      if (cursor.done) {
        resolve(records)
        return
      }
      
      let primaryKey = cursor.primaryKey
      if (primaryKey instanceof Object) {
        Object.freeze(primaryKey)
      }
      
      let preprocessedRecord = preprocessor(cursor.record, primaryKey)
      if (preprocessedRecord === UpgradedDatabaseSchema.DELETE_RECORD) {
        cursor.delete().
            then(() => cursor.advance()).
            then(iterate).
            catch(reject)
        return
      } else if (preprocessedRecord !== UpgradedDatabaseSchema.SKIP_RECORD) {
        records.push({
          key: primaryKey,
          record: preprocessedRecord
        })
      } else {
        // SKIP_RECORD returned, do nothing
      }
      
      cursor.advance().
          then(iterate).
          catch(reject)
    }
  })
}

/**
 * Creates a connection to an existing Indexed DB database. The returned
 * promise is rejected if the database does not exist (the
 * {@code upgradeneeded} event occurrs).
 * 
 * @param {IDBOpenDBRequest} request The database opening request.
 * @param {string[]} objectStoreNames The names of the object stores the
 *        database must contain. The returned promise is rejected if the
 *        database is missing any of the specified object stores.
 * @return {Promise<IDBDatabase>} A promise that resolves the the database
 *         connection.
 */
function openConnection(request, objectStoreNames) {
  return new Promise((resolve, reject) => {
    // Note: the "blocked" event cannot occurr since we're not upgrading an
    // existing database
    
    request.onsuccess = () => {
      let database = request.result
      
      let databaseObjectStores = Array.from(database.objectStoreNames)
      objectStoreNames.forEach((objectStoreName) => {
        if (databaseObjectStores.indexOf(objectStoreName) === -1) {
          reject(new Error(`The database ${database.name} does not contain ` +
              `the ${objectStoreName} object store`))
          database.close()
          return
        }
      })
      
      resolve(database)
    }
    
    request.onupgradeneeded = () => {
      request.transaction.abort()
      reject(new Error(`The database ${request.result.name} does not exist`))
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}
