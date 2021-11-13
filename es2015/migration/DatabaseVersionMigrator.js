
import PromiseSync from "../PromiseSync.js"
import Transaction from "../transaction/Transaction.js"
import ObjectStoreMigrator from "./ObjectStoreMigrator.js"

/**
 * Private field symbols.
 */
const FIELDS = Object.freeze({
  database: Symbol("database"),
  transaction: Symbol("transaction"),
  objectStores: Symbol("objectStores")
})

/**
 * Utility for migrating the database schema by a single version.
 */
export default class DatabaseVersionMigrator {
  /**
   * Initializes the database version migrator.
   * 
   * @param {IDBDatabase} database The database to upgrade.
   * @param {IDBTransaction} transaction The {@code versionchange} transaction.
   * @param {(ObjectStoreSchema[]|Object[])} objectStores Descriptors of object
   *        stores representing the schema the database should have after the
   *        migration. Use either {@linkcode ObjectStoreSchema} instances or
   *        plain object with compatible structure.
   */
  constructor(database, transaction, objectStores) {
    /**
     * The database to upgrade.
     * 
     * @type {IDBDatabase}
     */
    this[FIELDS.database] = database
    
    /**
     * The {@code versionchange} transaction.
     * 
     * @type {IDBTransaction}
     */
    this[FIELDS.transaction] = transaction
    
    /**
     * Descriptors of object stores representing the schema the database should
     * have after the migration.
     * 
     * @type {(ObjectStoreSchema[]|Object[])}
     */
    this[FIELDS.objectStores] = objectStores
    
    Object.freeze(this)
  }
  
  /**
   * Upgrades the database schema and executes the provided callback within the
   * transaction provided in the constructor.
   * 
   * @param {function(Transaction, Object<string, {key: (number|string|Date|Array), record: *}[]>): ?PromiseSync<undefined>} onComplete
   *        Callback to execute when the schema has been successfully migrated.
   *        If the callback performs database operations, it must execute the
   *        first operation synchronously, the subsequent operations may be
   *        executed from the operation promise callbacks.
   * @param {Object<string, {key: (number|string|Date|Array), record: *}[]>} callbackData
   *        The data to pass as the second argument of the callback.
   * @return {PromiseSync<undefined>} A promise that resolves when the database
   *         schema has been upgraded and the promise returned by the callback
   *         resolves.
   */
  executeMigration(onComplete, callbackData) {
    let nativeDatabase = this[FIELDS.database]
    let nativeTransaction = this[FIELDS.transaction]
    let objectStores = this[FIELDS.objectStores]
    upgradeSchema(nativeDatabase, nativeTransaction, objectStores)
    
    return PromiseSync.resolve().then(() => {
      let transaction = new Transaction(nativeTransaction, () => transaction)
      transaction.completionPromise.catch(() => {})
      
      let promise = PromiseSync.resolve(onComplete(transaction, callbackData))
      return promise.then(() => undefined)
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
 * @param {((DatabaseSchema|UpgradedDatabaseSchema))[]} descriptors Schema
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
