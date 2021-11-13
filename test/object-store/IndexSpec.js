
import DBFactory from "../../es2015/DBFactory.js"
import CursorDirection from "../../es2015/object-store/CursorDirection.js"
import KeyRange from "../../es2015/object-store/KeyRange.js"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema.js"
import IndexSchema from "../../es2015/schema/IndexSchema.js"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema.js"

describe("Index", () => {
    
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"

  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, "id", true,
          new IndexSchema("someIndex", "keyField", true, false),
          new IndexSchema("otherIndex", "otherKey", false, true)
        )
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      
      transaction = database.startTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      objectStore.add({
        id: 11,
        name: "John",
        keyField: 1,
        otherKey: "a"
      }).then(() => {
        return objectStore.add({
          id: 14,
          name: "Adam",
          keyField: 2,
          otherKey: "a"
        })
      }).then(() => {
        return objectStore.add({
          id: 17,
          name: "Joshua",
          keyField: 3,
          otherKey: ["c", "d"]
        })
      }).then(() => {
        return transaction.completionPromise
      }).then(() => {
        transaction = database.startTransaction(
          OBJECT_STORE_NAME
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
  
  it("should open a read-write cursor", (done) => {
    let index = objectStore.getIndex("someIndex")
    index.openCursor(null, CursorDirection.NEXT, false, (cursor) => {
      cursor.delete()
    }).then(() => transaction.completionPromise).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      return objectStore.count()
    }).then((count) => {
      expect(count).toBe(2)
      
      done()
    }).catch(error => fail(error))
  })

})
