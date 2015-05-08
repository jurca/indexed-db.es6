
import DBFactory from "../../dist/DBFactory"
import CursorDirection from "../../dist/object-store/CursorDirection"
import KeyRange from "../../dist/object-store/KeyRange"
import DatabaseSchema from "../../dist/schema/DatabaseSchema"
import IndexSchema from "../../dist/schema/IndexSchema"
import ObjectStoreSchema from "../../dist/schema/ObjectStoreSchema"

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
    index.openCursor(undefined, CursorDirection.NEXT, true).then((cursor) => {
      expect(cursor.record).toEqual({
        id: 11,
        name: "John",
        keyField: 1,
        otherKey: "a"
      })
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.record).toEqual({
        id: 17,
        name: "Joshua",
        keyField: 3,
        otherKey: ["c", "d"]
      })
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.record).toEqual({
        id: 17,
        name: "Joshua",
        keyField: 3,
        otherKey: ["c", "d"]
      })
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.done).toBeTruthy()
      
      done()
    })
  })
  
  it("should traverse the primary keys using a key cursor", (done) => {
    let index = objectStore.getIndex("otherIndex")
    let direction = CursorDirection.NEXT
    index.openKeyCursor(undefined, direction, true).then((cursor) => {
      expect(cursor.record).toBeNull()
      expect(cursor.key).toBe("a")
      expect(cursor.primaryKey).toBe(11)
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.key).toBe("c")
      expect(cursor.primaryKey).toBe(17)
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.key).toBe("d")
      expect(cursor.primaryKey).toBe(17)
      
      return cursor.continue()
    }).then((cursor) => {
      expect(cursor.done).toBeTruthy()
      
      done()
    })
  })
  
  it("should allow strings to specify cursor direction", (done) => {
    let index = objectStore.getIndex("otherIndex")
    index.openCursor(null, "NeXt").then((cursor) => {
      expect(cursor.key).toBe("a")
      
      return index.openCursor(null, "PReViouS")
    }).then((cursor) => {
      expect(cursor.key).toBe("d")
      
      return index.openKeyCursor(null, "prEV")
    }).then((cursor) => {
      expect(cursor.key).toBe("d")
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow strings to specify key cursor direction", (done) => {
    let index = objectStore.getIndex("otherIndex")
    index.openKeyCursor(null, "NeXt").then((cursor) => {
      expect(cursor.key).toBe("a")
      
      return index.openKeyCursor(null, "PReViouS")
    }).then((cursor) => {
      expect(cursor.key).toBe("d")
      
      return index.openKeyCursor(null, "prEV")
    }).then((cursor) => {
      expect(cursor.key).toBe("d")
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
})
