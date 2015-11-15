
import DBFactory from "../../es6/DBFactory"
import CursorDirection from "../../es6/object-store/CursorDirection"
import KeyRange from "../../es6/object-store/KeyRange"
import DatabaseSchema from "../../es6/schema/DatabaseSchema"
import IndexSchema from "../../es6/schema/IndexSchema"
import ObjectStoreSchema from "../../es6/schema/ObjectStoreSchema"

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
          new IndexSchema("index3", "age"),
          new IndexSchema("index4", ["foo", "age"])
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
  
  describe("query", () => {
    beforeEach(() => {
      transaction = database.startTransaction(OBJECT_STORE_NAME3)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME3)
      
      objectStore.add({
        category: 1,
        age: 10,
        bio: {
          cat: 1
        },
        foo: 5,
        unindexed: 1
      })
      objectStore.add({
        category: 2,
        age: 8,
        bio: {
          cat: 2
        },
        foo: 3,
        unindexed: 2
      })
      objectStore.add({
        category: [2, 3],
        age: 11,
        bio: {
          cat: 2
        },
        foo: 8,
        unindexed: 3
      })
      objectStore.add({
        category: 4,
        age: 12,
        bio: {
          cat: 4
        },
        foo: 8,
        unindexed: 3
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
    
    it("should reject negative offset", () => {
      expect(() => {
        objectStore.query(null, null, -1)
      }).toThrow()
    })
    
    it("should reject non-integer offset", () => {
      expect(() => {
        objectStore.query(null, null, 1.2)
      }).toThrow()
    })
    
    it("should reject negative or zero count limit", () => {
      expect(() => {
        objectStore.query(null, null, 0, -1)
      }).toThrow()
      
      expect(() => {
        objectStore.query(null, null, 0, 0)
      }).toThrow()
    })
    
    it("should reject non-integer count limit", () => {
      expect(() => {
        objectStore.query(null, null, 0, 1.2)
      }).toThrow()
    })
    
    it("should optimize by preferring object store to index", (done) => {
      objectStore = Object.create(objectStore)
      
      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }
      
      objectStore.query(null, "id").then((records) => {
        expect(calledCount).toBe(1)
        done()
      })
    })
    
    it("should optimize by using index to optimize filtering", (done) => {
      objectStore = Object.create(objectStore)
      
      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }
      
      objectStore.query({ age: 11 }, ["age", "!id"]).then((records) => {
        expect(calledCount).toBe(0)
        expect(records.length).toBe(1)
        expect(records[0].age).toBe(11)
        done()
      })
    })
    
    it("must not use multi-entry indexes to optimize queries", (done) => {
      objectStore = Object.create(objectStore)
      
      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }
      
      objectStore.query({ category: 2 }, ["age", "!id"]).then((records) => {
        expect(calledCount).toBe(1)
        expect(records.length).toBe(1)
        done()
      }).catch((error) => {
        fail(error)
        done()
      })
    })
    
    it("should optimize by using index to optimize sorting", (done) => {
      objectStore = Object.create(objectStore)
      
      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }
      
      objectStore.query(null, "age").then((records) => {
        expect(calledCount).toBe(0)
        expect(records.length).toBe(4)
        
        objectStore.query(null, ["!age"]).then((records) => {
          expect(calledCount).toBe(0)
          expect(records.length).toBe(4)
          done()
        })
      })
    })
    
    it("should prefer optimizing sorting to optimizing filtering", (done) => {
      objectStore = Object.create(objectStore)
      
      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }
      
      let index = objectStore.getIndex("index3")
      let nativeIndexMethod = index.createCursorFactory
      let calledIndexCount = 0
      let calledOn = null
      index.constructor.prototype.createCursorFactory =
          function (range, direction) {
        calledIndexCount++
        calledOn = this
        return nativeIndexMethod.call(index, range, direction)
      }
      
      objectStore.query({ category: 2 }, "!age").then((records) => {
        expect(calledCount).toBe(0)
        expect(calledIndexCount).toBe(1)
        expect(calledOn.name).toBe("index3")
        expect(records.length).toBe(1)
        index.constructor.prototype.createCursorFactory = nativeIndexMethod
        done()
      })
    })

    it("should use index for optimizing sorting if key path prefix matches",
        (done) => {
      objectStore = Object.create(objectStore)

      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }

      let index = objectStore.getIndex("index4")
      let nativeIndexMethod = index.createCursorFactory
      let calledIndexCount = 0
      let calledOn = null
      index.constructor.prototype.createCursorFactory =
          function (range, direction) {
        calledIndexCount++
        calledOn = this
        return nativeIndexMethod.call(index, range, direction)
      }

      objectStore.query(null, "foo").then((records) => {
        expect(calledCount).toBe(0)
        expect(calledIndexCount).toBe(1)
        expect(calledOn.name).toBe("index4")
        expect(recordsToIds(records)).toEqual([2, 1, 3, 4])
        index.constructor.prototype.createCursorFactory = nativeIndexMethod
        done()
      })
    })

    it("should use index for partially-optimizable filtering", (done) => {
      objectStore = Object.create(objectStore)

      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }

      let index = objectStore.getIndex("index3")
      let nativeIndexMethod = index.createCursorFactory
      let calledIndexCount = 0
      let calledOn = null
      index.constructor.prototype.createCursorFactory =
          function (range, direction) {
        calledIndexCount++
        calledOn = this
        return nativeIndexMethod.call(index, range, direction)
      }

      objectStore.query({ age: 11, bio: { cat: 2 } }, "unindexed").
          then((records) => {
        expect(calledCount).toBe(0)
        expect(calledIndexCount).toBe(1)
        expect(calledOn.name).toBe("index3")
        expect(recordsToIds(records)).toEqual([3])
        index.constructor.prototype.createCursorFactory = nativeIndexMethod
        done()
      })
    })

    it("should use index for partially-optimizable filtering that uses key " +
        "range outside of key path fields", (done) => {
      objectStore = Object.create(objectStore)

      let nativeMethod = objectStore.createCursorFactory
      let calledCount = 0
      objectStore.createCursorFactory = (range, direction) => {
        calledCount++
        return nativeMethod.call(objectStore, range, direction)
      }

      let index = objectStore.getIndex("index3")
      let nativeIndexMethod = index.createCursorFactory
      let calledIndexCount = 0
      let calledOn = null
      index.constructor.prototype.createCursorFactory =
      function (range, direction) {
        calledIndexCount++
        calledOn = this
        return nativeIndexMethod.call(index, range, direction)
      }

      objectStore.query({
        age: 11,
        bio: { cat: KeyRange.bound(1, 4) }
      }, "unindexed").then((records) => {
        expect(calledCount).toBe(0)
        expect(calledIndexCount).toBe(1)
        expect(calledOn.name).toBe("index3")
        expect(recordsToIds(records)).toEqual([3])
        index.constructor.prototype.createCursorFactory = nativeIndexMethod
        done()
      })
    })
    
    function recordsToIds(records) {
      return records.map(record => record.id)
    }
  })
  
})
