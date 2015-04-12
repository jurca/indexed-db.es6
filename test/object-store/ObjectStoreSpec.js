
import DBFactory from "../../dist/DBFactory"
import CursorDirection from "../../dist/object-store/CursorDirection"
import KeyRange from "../../dist/object-store/KeyRange"
import DatabaseSchema from "../../dist/schema/DatabaseSchema"
import IndexSchema from "../../dist/schema/IndexSchema"
import ObjectStoreSchema from "../../dist/schema/ObjectStoreSchema"

describe("ObjectStore", () => {

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

  it("should add new records", (done) => {
    objectStore.add({
      id: 20,
      name: "Franky"
    }).then(() => {
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.count().then((count) => {
        expect(count).toBe(4)
        
        done()
      })
    })
  })
  
  it("should update the existing records", (done) => {
    objectStore.put({
      id: 17,
      name: "Jimmy",
      keyField: 7,
      otherKey: "x"
    }).then(() => transaction.completionPromise).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.get(17).then((record) => {
        expect(record).toEqual({
          id: 17,
          name: "Jimmy",
          keyField: 7,
          otherKey: "x"
        })
        
        done()
      })
    })
  })
  
  it("should delete records", (done) => {
    objectStore.delete(KeyRange.bound(10, 15)).then(() => {
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.count().then((count) => {
        expect(count).toBe(1)
        
        done()
      })
    })
  })
  
  it("should delete records matching a predicate function", (done) => {
    objectStore.delete((record, primaryKey) => primaryKey > 12).then(() => {
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.count().then((count) => {
        expect(count).toBe(1)
        
        done()
      })
    })
  })
  
  it("should clear all records", (done) => {
    objectStore.clear(() => transaction.completionPromise).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.count().then((count) => {
        expect(count).toBe(0)
        
        done()
      })
    })
  })
  
  it("should provide access to indexes", () => {
    objectStore.getIndex("someIndex")
    
    let index = objectStore.getIndex("otherIndex")
    expect(objectStore.getIndex("otherIndex")).toBe(index)
  })
  
  it("should open a read-write cursor", (done) => {
    objectStore.openCursor().then((cursor) => {
      cursor.delete()
      
      return transaction.completionPromise
    }).then(() => {
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      
      objectStore.count().then((count) => {
        expect(count).toBe(2)
        
        done()
      })
    })
  })
  
})
