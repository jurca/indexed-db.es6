
import DBFactory from "../../compiled/DBFactory"
import CursorDirection from "../../compiled/object-store/CursorDirection"
import KeyRange from "../../compiled/object-store/KeyRange"
import DatabaseSchema from "../../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../../compiled/schema/ObjectStoreSchema"

describe("AbstractReadOnlyStorage", () => {
  
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  const OBJECT_STORE_NAME2 = "fooBar2"
  
  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, "id"),
        new ObjectStoreSchema(OBJECT_STORE_NAME2, ["id1", "id2"])
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      
      transaction = database.startTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      objectStore.add({
        id: 11,
        name: "John"
      }).then(() => {
        return objectStore.add({
          id: 14,
          name: "Adam"
        })
      }).then(() => {
        return objectStore.add({
          id: 17,
          name: "Joshua"
        })
      }).then(() => {
        return transaction.completionPromise
      }).then(() => {
        transaction = database.startReadOnlyTransaction(
          OBJECT_STORE_NAME,
          OBJECT_STORE_NAME2
        )
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
  
  it("should allow iterating using forEach", (done) => {
    let lastId = 0
    let callbackExecuted = false
    
    objectStore.forEach(undefined, CursorDirection.NEXT, (record, id, key) => {
      callbackExecuted = true
      
      expect(id).toBe(key)
      expect(id).toBeGreaterThan(10)
      expect(record.id).toBe(id)
      
      expect(id).toBeGreaterThan(lastId)
      lastId = id
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      expect(callbackExecuted).toBeTruthy()
      done()
    }).catch(error => fail(error.stack || error.message))
  })
  
})
