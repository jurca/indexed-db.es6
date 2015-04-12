
import DBFactory from "../../dist/DBFactory"
import DatabaseSchema from "../../dist/schema/DatabaseSchema"
import ObjectStoreSchema from "../../dist/schema/ObjectStoreSchema"

describe("Cursor", () => {

  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  
  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME)
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      
      transaction = database.startTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      objectStore.add("foo", 1).then(() => {
        return objectStore.add("bar", 2)
      }).then(() => {
        return objectStore.add("xyz", 3)
      }).then(() => {
        return transaction.completionPromise
      }).then(() => {
        transaction = database.startTransaction(OBJECT_STORE_NAME)
        objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
        done()
      })
    }).catch((error) => fail(error))
  })
  
  afterEach((done) => {
    database.close()
    
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("should update records", (done) => {
    objectStore.openCursor().then((cursor) => {
      return cursor.update("updated, yeah!")
    }).then((primaryKey) => {
      expect(primaryKey).toBe(1)
      
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      return objectStore.get(1)
    }).then((record) => {
      expect(record).toBe("updated, yeah!")
      
      done()
    })
  })
  
  it("should delete records", (done) => {
    objectStore.openCursor().then((cursor) => {
      return cursor.delete()
    }).then(() => {
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      return objectStore.get(1)
    }).then((record) => {
      expect(record).toBeUndefined()
      
      done()
    })
  })
  
})
