
import DBFactory from "../../compiled/DBFactory"
import DatabaseSchema from "../../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../../compiled/schema/ObjectStoreSchema"

describe("ReadOnlyCursor", () => {
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  
  let database
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME)
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      
      let transaction = database.startTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      objectStore.add("foo", 1).then(() => {
        return objectStore.add("bar", 2)
      }).then(() => {
        return objectStore.add("xyz", 3)
      }).then(() => {
        return transaction.completionPromise
      }).then(() => {
        let transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
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
  
  it("should traverse all records", (done) => {
    objectStore.openCursor().then((cursor) => {
      expect(cursor.key).toBe(1)
      expect(cursor.primaryKey).toBe(1)
      expect(cursor.record).toBe("foo")
      expect(cursor.unique).toBeFalsy()
      expect(cursor.direction.value).toBe("NEXT")
      expect(cursor.done).toBeFalsy()
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.key).toBe(2)
      expect(cursor.primaryKey).toBe(2)
      expect(cursor.record).toBe("bar")
      
      return cursor.advance()
    }).then((cursor) => {
      expect(cursor.key).toBe(3)
      expect(cursor.primaryKey).toBe(3)
      expect(cursor.record).toBe("xyz")
      expect(cursor.done).toBeFalsy()
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.done).toBeTruthy()
      
      done()
    })
  })
  
  it("should allow skipping records by keys and recourd counts", (done) => {
    objectStore.openCursor().then((cursor) => {
      expect(cursor.key).toBe(1)
      expect(cursor.record).toBe("foo")
      
      return cursor.advance(2)
    }).then((cursor) => {
      expect(cursor.key).toBe(3)
      expect(cursor.record).toBe("xyz")
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.done).toBeTruthy()
      
      return objectStore.openCursor()
    }).then((cursor) => {
      expect(cursor.key).toBe(1)
      expect(cursor.record).toBe("foo")
      
      return cursor.continue(3)
    }).then((cursor) => {
      expect(cursor.key).toBe(3)
      expect(cursor.record).toBe("xyz")
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor).toBeTruthy()
      
      done()
    })
  })
  
})
