
import DBFactory from "../../dist/DBFactory"
import CursorDirection from "../../dist/object-store/CursorDirection"
import KeyRange from "../../dist/object-store/KeyRange"
import DatabaseSchema from "../../dist/schema/DatabaseSchema"
import IndexSchema from "../../dist/schema/IndexSchema"
import ObjectStoreSchema from "../../dist/schema/ObjectStoreSchema"

describe("ReadOnlyObjectStore", () => {
  
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  const OBJECT_STORE_NAME2 = "fooBar2"
  
  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, "id", true,
          new IndexSchema("someIndex", "keyField")
        ),
        new ObjectStoreSchema(OBJECT_STORE_NAME2, ["id1", "id2"], false,
          new IndexSchema("someIndex", "keyField"),
          new IndexSchema("otherIndex", ["keyField", "otherKey"])
        )
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
  
  it("should report the correct auto increment flag value", () => {
    expect(objectStore.autoIncrement).toBeTruthy()
    
    objectStore = transaction.getObjectStore(OBJECT_STORE_NAME2)
    expect(objectStore.autoIncrement).toBeFalsy()
  })
  
  it("should report the corrent index names", () => {
    expect(objectStore.indexNames).toEqual(["someIndex"])
    
    objectStore = transaction.getObjectStore(OBJECT_STORE_NAME2)
    expect(objectStore.indexNames).toEqual(["otherIndex", "someIndex"])
  })
  
  it("should provide access to the indexes", () => {
    objectStore.getIndex("someIndex")
    
    objectStore = transaction.getObjectStore(OBJECT_STORE_NAME2)
    objectStore.getIndex("someIndex")
    objectStore.getIndex("otherIndex")
  })
  
  it("should return the same index when call repeatedly", () => {
    let index = objectStore.getIndex("someIndex")
    expect(objectStore.getIndex("someIndex")).toEqual(index)
  })
  
})
