
import DBFactory from "../../es2015/DBFactory"
import PromiseSync from "../../es2015/PromiseSync"
import CursorDirection from "../../es2015/object-store/CursorDirection"
import KeyRange from "../../es2015/object-store/KeyRange"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema"
import IndexSchema from "../../es2015/schema/IndexSchema"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema"

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
    }).catch(error => fail(error))
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
    objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
      cursor.delete()
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
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

  it("should execute an update query", (done) => {
    objectStore.updateQuery({ id: 14 })((record, id) => {
      expect(id).toBe(14)
      expect(record).toEqual({
        id: 14,
        name: "Adam",
        keyField: 2,
        otherKey: "a"
      })

      return {
        id: 14,
        name: "Big boy"
      }
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
    })

    transaction.completionPromise.then(() => {
      return database.runTransaction(OBJECT_STORE_NAME, (objectStore) => {
        return objectStore.get(14)
      })
    }).then((updatedRecord) => {
      expect(updatedRecord).toEqual({
        id: 14,
        name: "Big boy"
      })

      done()
    }).catch((error) => {
      fail(error)
      done()
    })
  })

  it("should execute a delete query", (done) => {
    objectStore.deleteQuery(null, "!id", 1, 1).then((recordCount) => {
      expect(recordCount).toBe(1)
    })

    transaction.completionPromise.then(() => {
      return database.runTransaction(OBJECT_STORE_NAME, (objectStore) => {
        return objectStore.getAll()
      })
    }).then((records) => {
      expect(records).toEqual([
        {
          id: 11,
          name: "John",
          keyField: 1,
          otherKey: "a"
        },
        {
          id: 17,
          name: "Joshua",
          keyField: 3,
          otherKey: ["c", "d"]
        }
      ])
    }).then(() => {
      done()
    }).catch((error) => {
      fail(error)
      done()
    })
  })
  
})
