
import DBFactory from "../../es2015/DBFactory"
import CursorDirection from "../../es2015/object-store/CursorDirection"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema"

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
    objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
      switch (cursor.key) {
        case 1:
          expect(cursor.primaryKey).toBe(1)
          expect(cursor.record).toBe("foo")
          expect(cursor.unique).toBeFalsy()
          expect(cursor.direction.value).toBe("NEXT")
          break
        case 2:
          expect(cursor.primaryKey).toBe(2)
          expect(cursor.record).toBe("bar")
          break
        case 3:
          expect(cursor.primaryKey).toBe(3)
          expect(cursor.record).toBe("xyz")
          break
        default:
          throw new Error("unexepected record")
      }
      
      cursor.continue()
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      
      done()
    })
  })
  
  it("should allow skipping records by keys and recourd counts", (done) => {
    objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
      if (cursor.key === 1) {
        expect(cursor.record).toBe("foo")
        cursor.advance(2)
      } else if (cursor.key === 3) {
        expect(cursor.record).toBe("xyz")
        cursor.continue()
      } else {
        throw new Error("unexpected record")
      }
    }).then((recordCount) => {
      expect(recordCount).toBe(2)
      
      return objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
        if (cursor.key === 1) {
          expect(cursor.record).toBe("foo")
          cursor.continue(3)
        } else if (cursor.key === 3) {
          expect(cursor.record).toBe("xyz")
          cursor.continue()
        } else {
          throw new Error("unexpected record")
        }
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(2)
      
      done()
    })
  })
  
})
