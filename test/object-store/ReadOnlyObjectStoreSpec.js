
import DBFactory from "../../es2015/DBFactory.js"
import CursorDirection from "../../es2015/object-store/CursorDirection.js"
import KeyRange from "../../es2015/object-store/KeyRange.js"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema.js"
import IndexSchema from "../../es2015/schema/IndexSchema.js"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema.js"

describe("ReadOnlyObjectStore", () => {
  
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  const OBJECT_STORE_NAME2 = "fooBar2"
  const OBJECT_STORE_NAME3 = "fooBar3"
  
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
        ),
        new ObjectStoreSchema(OBJECT_STORE_NAME3, "id", true,
          new IndexSchema("index1", "id"), // will never be used, because the
                                           // id is not set when creating the
                                           // record
          new IndexSchema("index2", "category", false, true),
          new IndexSchema("index3", "age")
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
  
  describe("query", () => {
    beforeEach(() => {
      transaction = database.startTransaction(OBJECT_STORE_NAME3)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME3)
      
      objectStore.add({
        category: 1,
        age: 10,
        bio: {
          cat: 1
        }
      })
      objectStore.add({
        category: 2,
        age: 8,
        bio: {
          cat: 2
        }
      })
      objectStore.add({
        category: [2, 3],
        age: 11,
        bio: {
          cat: 2
        }
      })
      objectStore.add({
        category: 4,
        age: 12,
        bio: {
          cat: 4
        }
      })
    })
    
    it("should fetch all records", (done) => {
      objectStore.query().then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        done()
      })
    })
    
    it("should allow filtering", (done) => {
      objectStore.query(2).then((records) => {
        expect(recordsToIds(records)).toEqual([2])
        
        return objectStore.query(KeyRange.bound(2, 3))
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([2, 3])
        
        return objectStore.query({ id: 3 })
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([3])
        
        return objectStore.query((record, primaryKey, key) => {
          return primaryKey > 2
        })
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([3, 4])
        
        return objectStore.query({ category: [2, 3] })
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([3])
        
        return objectStore.query({ age: KeyRange.bound(11, 12) })
      }).then((records) => {
        done()
      }).catch((error) => {
        fail(error)
        done()
      })
    })
    
    it("should allow sorting", (done) => {
      objectStore.query(null, "neXt").then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        return objectStore.query(null, CursorDirection.PREVIOUS)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([4, 3, 2, 1])
        
        return objectStore.query(null, null)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        return objectStore.query(null, "id")
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        return objectStore.query(null, "!id")
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([4, 3, 2, 1])
        
        return objectStore.query(null, ["!bio.cat", "id"])
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([4, 2, 3, 1])
        
        return objectStore.query(null, (r1, r2) => r1.id - r2.id)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        done()
      }).catch((error) => {
        fail(error)
        done()
      })
    })
    
    it("should allow specifying an offset", (done) => {
      objectStore.query(null, null, 0).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        return objectStore.query(null, null, 3)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([4])
        
        return objectStore.query(null, null, 10)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([])
        
        done()
      }).catch((error) => {
        fail(error)
        done()
      })
    })
    
    it("should allow specifying the count limit", (done) => {
      objectStore.query(null, null, 0, null).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        return objectStore.query(null, null, 0, 2)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2])
        
        return objectStore.query(null, null, 0, 10)
      }).then((records) => {
        expect(recordsToIds(records)).toEqual([1, 2, 3, 4])
        
        done()
      }).catch((error) => {
        fail(error)
        done()
      })
    })
    
    function recordsToIds(records) {
      return records.map(record => record.id)
    }
  })
  
})
