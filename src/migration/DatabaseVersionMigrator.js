
import Database from "../Database"
import ObjectStoreMigrator from "./ObjectStoreMigrator"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  databaseName: Symbol("databaseName"),
  targetVersion: Symbol("targetVersion"),
  objectStores: Symbol("objectStores"),
  transactionCommitDelay: Symbol("transactionCommitDelay")
})

/**
 * Utility for migrating the database schema by a single version.
 */
export default class DatabaseVersionMigrator {
  /**
   * Initializes the database version migrator.
   * 
   * @param {string} databaseName The name of the database to upgrade.
   * @param {number} targetVersion The version number to which the database
   *        should be upgraded. The version must be higher than the current
   *        version and can be greater by any amount.
   * @param {(ObjectStoreSchema[]|Object[])} objectStores Descriptors of object
   *        stores representing the schema the database should have after the
   *        migration. Use either {@codelink ObjectStoreSchema} instances or
   *        plain object with compatible structure.
   * @param {number} transactionCommitDelay The delay in milliseconds before an
   *        inactive transaction shuold be committed.
   */
  constructor(databaseName, targetVersion, objectStores,
      transactionCommitDelay) {
    /**
     * The name of the database to upgrade.
     * 
     * @type {number}
     */
    this[FIELDS.databaseName] = databaseName
    
    /**
     * The version number to which the database should be upgraded.
     * 
     * @type {number}
     */
    this[FIELDS.targetVersion] = targetVersion
    
    /**
     * Descriptors of object stores representing the schema the database should
     * have after the migration.
     * 
     * @type {(ObjectStoreSchema[]|Object[])}
     */
    this[FIELDS.objectStores] = objectStores
    
    /**
     * The delay in milliseconds before an inactive transaction shuold be
     * committed.
     * 
     * @type {number}
     */
    this[FIELDS.transactionCommitDelay] = transactionCommitDelay
    
    Object.freeze(this)
  }
  
  /**
   * Opens a new connection to the database, upgrades the database schema and
   * executes the provided callback within the same transaction. The method
   * automatically terminates the created database connection.
   * 
   * @param {function(Transaction, Object<string, {key: (number|string|Date|Array), record: *}[]>): ?Promise<undefined>}
   *        onComplete Callback to execute when the schema has been
   *        successfully migrated. If the callback performs database
   *        operations, it must execute the first operation synchronously, the
   *        subsequent operations may be executed from the operation promise
   *        callbacks.
   * @param {Object<string, {key: (number|string|Date|Array), record: *}[]>}
   *        callbackData The data to pass as the second argument of the
   *        callback.
   * @return {Promise<undefined>} A promise that resolves when the database
   *         schema has been upgraded and the promise returned by the callback
   *         resolves.
   */
  executeMigration(onComplete, callbackData) {
    let openedDatabase
    
    let request = indexedDB.open(
      this[FIELDS.databaseName],
      this[FIELDS.targetVersion]
    )
    
    return openConnection(request, (nativeDatabase, nativeTransaction) => {
      let objectStores = this[FIELDS.objectStores]
      upgradeSchema(nativeDatabase, nativeTransaction, objectStores)
      
      let objectStoreNames = this[FIELDS.objectStores].map((objectStore) => {
        return objectStore.name
      })
      
      let transactionCommitDelay = this[FIELDS.transactionCommitDelay]
      let database = new Database(nativeDatabase, transactionCommitDelay)
      openedDatabase = database
      let transaction = database.startTransaction(objectStoreNames)
      return Promise.resolve(onComplete(transaction, callbackData))
    }).catch((error) => {
      if (openedDatabase) {
        openedDatabase.close()
      }
      
      throw error
    })
  }
}

/**
 * Updates the schema of the provided Indexed DB database to the schema
 * specified by the provided schema descriptors.
 * 
 * @param {IDBDatabase} nativeDatabase The native Indexed DB database being
 *        migrated.
 * @param {IDBTransaction} nativeTransaction The native {@code versionchange}
 *        transaction.
 * @param ((DatabaseSchema|UpgradedDatabaseSchema)) descriptors Schema
 *        descriptor of the version to which the database is to be upgraded.
 */
function upgradeSchema(nativeDatabase, nativeTransaction, descriptors) {
  let objectStoreNames = Array.from(nativeDatabase.objectStoreNames)
  let newObjectStoreNames = descriptors.map((objectStore) => {
    return objectStore.name
  })
  objectStoreNames.forEach((objectStoreName) => {
    if (newObjectStoreNames.indexOf(objectStoreName) === -1) {
      nativeDatabase.deleteObjectStore(objectStoreName)
    }
  })

  descriptors.forEach((objectStoreDescriptor) => {
    let objectStoreName = objectStoreDescriptor.name
    let nativeObjectStore = objectStoreNames.indexOf(objectStoreName) > -1 ?
        nativeTransaction.objectStore(objectStoreName) : null

    let objectStoreMigrator = new ObjectStoreMigrator(nativeDatabase,
        nativeObjectStore, objectStoreDescriptor)
    objectStoreMigrator.executeMigration()
  })
}

/**
 * Creates a connection to an Indexed DB database in order to upgrade its
 * schema.
 * 
 * @param {IDBOpenDBRequest} request The database opening request.
 * @param {function(IDBDatabase, IDBTransaction)} onUpgradeReady A callback to
 *        synchronously execute on the {@code upgradeneeded} event.
 * @return {Promise<undefined>} A promise that resolves when the upgrade is
 *         successfuly completed and the database connection is closed.
 */
function openConnection(request, onUpgradeReady) {
  return new Promise((resolve, reject) => {
    let wasBlocked = false
    let upgradeExecuted = false
    
    request.onsuccess = () => {
      let database = request.result
      database.close()
      
      if (!upgradeExecuted) {
        reject(new Error("The database was already at version " +
            database.verion))
      }
      
      resolve()
    }
    
    request.onupgradeneeded = () => {
      if (wasBlocked) {
        request.transaction.abort()
        return
      }
      
      onUpgradeReady(request.result, request.transaction)
      upgradeExecuted = true
    }
    
    request.onerror = () => {
      if (wasBlocked) {
        event.preventDefault()
        return
      }
      
      reject(request.error)
    }
    
    request.onblocked = () => {
      wasBlocked = true
      
      let error = new Error("The database upgrade could not be performed " +
          "because the attempt was blocked by a connection that remained " +
          "opened after receiving the notification")
      reject(error)
    }
  })
}

