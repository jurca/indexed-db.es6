
import DBFactory from "../../es2015/DBFactory"
import CursorDirection from "../../es2015/object-store/CursorDirection"
import KeyRange from "../../es2015/object-store/KeyRange"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema"

describe("AbstractBaseStorage", () => {

  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  const OBJECT_STORE_NAME2 = "fooBar2"
  
  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME),
        new ObjectStoreSchema(OBJECT_STORE_NAME2, ["id1", "id2"])
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
  
  it("should retrieve existing record", (done) => {
    objectStore.get(2).then((record) => {
      expect(record).toBe("bar")
      
      return transaction.completionPromise
    }).then(() => {
      done()
    })
  })
  
  it("should return undefined for nonexisting record", (done) => {
    objectStore.get(123).then((record) => {
      expect(record).toBeUndefined()
      
      return transaction.completionPromise
    }).then(() => {
      done()
    })
  })
  
  it("should provide correct object store name", () => {
    expect(objectStore.name).toBe(OBJECT_STORE_NAME)
  })
  
  it("should provide correct object store keypath", () => {
    expect(objectStore.keyPath).toBeNull()
    
    let otherObjectStore = transaction.getObjectStore(OBJECT_STORE_NAME2)
    expect(otherObjectStore.keyPath).toEqual(["id1", "id2"])
  })
  
  it("should open cursor", (done) => {
    let callbackExecuted = false
    
    objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
      expect(cursor.record).toBe("foo")
      callbackExecuted = true
    }).then((recordCount) => {
      expect(callbackExecuted).toBeTruthy()
      expect(recordCount).toBe(1)
      
      return objectStore.openCursor(2, CursorDirection.NEXT, (cursor) => {
        expect(cursor.record).toBe("bar")
        cursor.continue()
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.openCursor(undefined, CursorDirection.PREVIOUS,
          (cursor) => {
        expect(cursor.record).toBe("xyz")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.openCursor(
        KeyRange.upperBound(2, true),
        CursorDirection.PREVIOUS,
        (cursor) => {
          expect(cursor.record).toBe("foo")
        }
      )
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.openCursor(null, CursorDirection.NEXT, (cursor) => {
        cursor.advance()
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
    }).then(() => transaction.completionPromise).then(() => {
      done()
    }).catch((error) => {
      console.error(error)
      fail(error.message)
    })
  })
  
  it("should allow strings to specify cursor direction", (done) => {
    objectStore.openCursor(null, "NeXt", (cursor) => {
      expect(cursor.record).toBe("foo")
    }).then(() => {
      return objectStore.openCursor(null, "PReViouS", (cursor) => {
        expect(cursor.record).toBe("xyz")
      })
    }).then(() => {
      return objectStore.openCursor(null, "prEv", (cursor) => {
        expect(cursor.record).toBe("xyz")
      })
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
  it("should create cursor factory", (done) => {
    let callbackExecuted = false
    
    objectStore.createCursorFactory()((cursor) => {
      expect(cursor.record).toBe("foo")
      callbackExecuted = true
    }).then((recordCount) => {
      expect(callbackExecuted).toBeTruthy()
      expect(recordCount).toBe(1)
      
      return objectStore.createCursorFactory(2)((cursor) => {
        expect(cursor.record).toBe("bar")
        cursor.continue()
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      let factory = objectStore.createCursorFactory(
        undefined,
        CursorDirection.PREVIOUS
      )
      return factory((cursor) => {
        expect(cursor.record).toBe("xyz")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.createCursorFactory(
        KeyRange.upperBound(2, true),
        CursorDirection.PREVIOUS
      )((cursor) => {
        expect(cursor.record).toBe("foo")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.createCursorFactory(null)((cursor) => {
        cursor.advance()
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
    }).then(() => transaction.completionPromise).then(() => {
      done()
    }).catch((error) => {
      console.error(error)
      fail(error.message)
    })
  })
})
