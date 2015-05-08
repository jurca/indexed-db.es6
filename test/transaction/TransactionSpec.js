
import DBFactory from "../../amd/DBFactory"
import DatabaseSchema from "../../amd/schema/DatabaseSchema"
import ObjectStoreSchema from "../../amd/schema/ObjectStoreSchema"

describe("Transaction", () => {
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  
  let database
  let transaction
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME)
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      transaction = database.startTransaction(OBJECT_STORE_NAME)
      done()
    }).catch((error) => fail(error))
  })
  
  afterEach((done) => {
    database.close()
    
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("should provide read-write access to object stores", (done) => {
    let objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
    objectStore.add("Foooooo... bar!", 11).then(() => {
      return transaction.completionPromise
    }).then(() => {
      done()
    }).catch((error) => fail(error))
  })
  
})
