
import ObjectStoreMigrator from "../../compiled/migration/ObjectStoreMigrator"
import IndexSchema from "../../compiled/schema/IndexSchema"
import ObjectStoreSchema from "../../compiled/schema/ObjectStoreSchema"

describe("ObjectStoreMigrator", () => {
  
  const DB_NAME = "testing database"
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = done
    request.onerror = () => fail(request.error)
  })
  
  function connectForUpgrade() {
    return new Promise((resolve, reject) => {
      let request = indexedDB.open(DB_NAME, 1)
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
  
  it("should create new object store", (done) => {
    connectForUpgrade().then((connection) => {
      let { database, transaction, request } = connection
      
      let migrator = new ObjectStoreMigrator(database, null,
        new ObjectStoreSchema("fooBar", null, true,
          new IndexSchema("my index", ["some.key", "other.deep.field", "abc"])
        )
      )
      
      migrator.executeMigration()
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result)
      })
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      let index = objectStore.index("my index")
        
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
})
