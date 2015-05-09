
import DBFactory from "../../amd/DBFactory"
import CursorDirection from "../../amd/object-store/CursorDirection"
import KeyRange from "../../amd/object-store/KeyRange"
import DatabaseSchema from "../../amd/schema/DatabaseSchema"
import IndexSchema from "../../amd/schema/IndexSchema"
import ObjectStoreSchema from "../../amd/schema/ObjectStoreSchema"

describe("ReadOnlyIndex", () => {
  
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
        transaction = database.startReadOnlyTransaction(
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
  
  it("should report the correct multiEntry flag value", () => {
    expect(objectStore.getIndex("someIndex").multiEntry).toBeFalsy()
    expect(objectStore.getIndex("otherIndex").multiEntry).toBeTruthy()
  })
  
  it("should report the correct unique flag value", () => {
    expect(objectStore.getIndex("someIndex").unique).toBeTruthy()
    expect(objectStore.getIndex("otherIndex").unique).toBeFalsy()
  })
  
  it("should fetch the primary key", (done) => {
    objectStore.getIndex("otherIndex").getPrimaryKey(("c")).then((key) => {
      expect(key).toBe(17)
      
      return objectStore.getIndex("otherIndex").getPrimaryKey("d")
    }).then((key) => {
      expect(key).toBe(17)
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should fetch all primary keys", (done) => {
    objectStore.getIndex("otherIndex").getAllPrimaryKeys().then((keys) => {
      expect(keys).toEqual([11, 14, 17, 17]);
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should traverse the records using a cursor", (done) => {
    let index = objectStore.getIndex("otherIndex")
    index.openCursor(undefined, CursorDirection.NEXT, true, (cursor) => {
      switch (cursor.primaryKey) {
        case 11:
          expect(cursor.record).toEqual({
            id: 11,
            name: "John",
            keyField: 1,
            otherKey: "a"
          })
          break
        case 17:
          expect(cursor.record).toEqual({
            id: 17,
            name: "Joshua",
            keyField: 3,
            otherKey: ["c", "d"]
          })
          break
        default:
          fail("unexpected record")
          break
      }
      
      cursor.advance()
    }).then((iterationCount) => {
      expect(iterationCount).toBe(3)
      done()
    })
  })
  
  it("should provide a cursor factory for traversing the records", (done) => {
    let index = objectStore.getIndex("otherIndex")
    let factory = index.createCursorFactory(
      undefined,
      CursorDirection.NEXT,
      true
    )
    factory((cursor) => {
      switch (cursor.primaryKey) {
        case 11:
          expect(cursor.record).toEqual({
            id: 11,
            name: "John",
            keyField: 1,
            otherKey: "a"
          })
          break
        case 17:
          expect(cursor.record).toEqual({
            id: 17,
            name: "Joshua",
            keyField: 3,
            otherKey: ["c", "d"]
          })
          break
        default:
          fail("unexpected record")
          break
      }
      
      cursor.advance()
    }).then((iterationCount) => {
      expect(iterationCount).toBe(3)
      done()
    })
  })
  
  it("should traverse the primary keys using a key cursor", (done) => {
    let index = objectStore.getIndex("otherIndex")
    index.openKeyCursor(undefined, CursorDirection.NEXT, true, (cursor) => {
      expect(cursor.record).toBeUndefined()
      switch (cursor.key) {
        case "a":
          expect(cursor.primaryKey).toBe(11)
          break
        case "c":
        case "d":
          expect(cursor.primaryKey).toBe(17)
          break
      }
      
      cursor.continue()
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      done()
    })
  })
  
  it("should provide a key cursor factory for traversing the primary keys",
      (done) => {
    let index = objectStore.getIndex("otherIndex")
    let factory = index.createKeyCursorFactory(
      undefined,
      CursorDirection.NEXT,
      true
    )
    factory((cursor) => {
      expect(cursor.record).toBeUndefined()
      switch (cursor.key) {
        case "a":
          expect(cursor.primaryKey).toBe(11)
          break
        case "c":
        case "d":
          expect(cursor.primaryKey).toBe(17)
          break
      }
      
      cursor.continue()
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      done()
    })
  })
  
  it("should allow strings to specify cursor direction", (done) => {
    let index = objectStore.getIndex("otherIndex")
    
    index.openCursor(null, "NeXt", false, (cursor) => {
      expect(cursor.key).toBe("a")
    }).then(() => {
      return index.openCursor(null, "PReViouS", false, (cursor) => {
        expect(cursor.key).toBe("d")
      })
    }).then(() => {
      return index.openCursor(null, "prEV", false, (cursor) => {
        expect(cursor.key).toBe("d")
      })
    }).then(() => done()).catch(error => fail(error))
  })
  
  it("should allow strings to specify key cursor direction", (done) => {
    let index = objectStore.getIndex("otherIndex")
    
    index.openKeyCursor(null, "NeXt", false, (cursor) => {
      expect(cursor.key).toBe("a")
    }).then(() => {
      return index.openKeyCursor(null, "PReViouS", false, (cursor) => {
        expect(cursor.key).toBe("d")
      })
    }).then(() => {
      return index.openKeyCursor(null, "prEV", false, (cursor) => {
        expect(cursor.key).toBe("d")
      })
    }).then(() => done()).catch(error => fail(error))
  })
  
})
