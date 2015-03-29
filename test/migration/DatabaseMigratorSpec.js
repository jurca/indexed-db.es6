
import DatabaseMigrator from "../../compiled/migration/DatabaseMigrator"
import DatabaseSchema from "../../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../../compiled/schema/ObjectStoreSchema"
import UpgradedDatabaseSchema
    from "../../compiled/schema/UpgradedDatabaseSchema"

describe("DatabaseMigrator", () => {
  
  const DB_NAME = "testing database"
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = done
    request.onerror = () => fail(request.error)
  })
  
  function connectForUpgrade() {
    return new Promise((resolve, reject) => {
      let request = indexedDB.open(DB_NAME, 2)
      request.onerror = reject
      request.onblocked = reject
      request.onupgradeneeded = () => {
        resolve({
          database: request.result,
          transaction: request.transaction,
          request: request
        })
      }
    })
  }
  
  it("should do nothing if the db version is the greatest described", () => {
    let migrator = new DatabaseMigrator(null, null, [
      new DatabaseSchema(1),
      new UpgradedDatabaseSchema(2, [], [])
    ], 2)
    
    migrator.executeMigration()
  })
  
  it("should perform database creation and upgrade", (done) => {
    connectForUpgrade().then((connection) => {
      let { database, transaction, request } = connection
      
      let migrator = new DatabaseMigrator(database, transaction, [
        new DatabaseSchema(1,
          new ObjectStoreSchema("fooBar", null, false)
        ),
        new UpgradedDatabaseSchema(2, [], [
          new ObjectStoreSchema("fooBar2", null, false)
        ])
      ], 0)
      
      migrator.executeMigration()
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result)
      })
    }).then((database) => {
      let objectStores = Array.from(database.objectStoreNames)
      expect(objectStores).toEqual(["fooBar2"])
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
})
