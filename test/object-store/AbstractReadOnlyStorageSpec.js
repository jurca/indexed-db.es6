
import DBFactory from "../../es2015/DBFactory"
import CursorDirection from "../../es2015/object-store/CursorDirection"
import KeyRange from "../../es2015/object-store/KeyRange"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema"

describe("AbstractReadOnlyStorage", () => {
  
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  const OBJECT_STORE_NAME2 = "fooBar2"
  
  let database
  let transaction
  let objectStore
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, "id"),
        new ObjectStoreSchema(OBJECT_STORE_NAME2, ["id1", "id2"])
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
  
  it("should allow iterating using forEach", (done) => {
    let lastId = 0
    let callbackExecuted = false
    
    objectStore.forEach(undefined, CursorDirection.NEXT, (record, id, key) => {
      callbackExecuted = true
      
      expect(id).toBe(key)
      expect(id).toBeGreaterThan(10)
      expect(record.id).toBe(id)
      
      expect(id).toBeGreaterThan(lastId)
      lastId = id
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      expect(callbackExecuted).toBeTruthy()
      
      lastId = 1000
      return objectStore.forEach(undefined, CursorDirection.PREVIOUS, (r) => {
        expect(r.id).toBeLessThan(lastId)
        lastId = r.id
      })
    }).then((count) => {
      expect(count).toBe(3)
      
      return objectStore.forEach(14, CursorDirection.NEXT, (record) => {
        expect(record.id).toBe(14)
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      let NEXT = CursorDirection.NEXT
      return objectStore.forEach(KeyRange.bound(10, 15), NEXT, (record) => {
        expect(record.id).toBeLessThan(16)
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(2)
      
      return objectStore.forEach({
        id: KeyRange.bound(10, 15),
        name: "Adam"
      }, CursorDirection.NEXT, (record) => {
        expect(record.name).toBe("Adam")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.forEach({
        id: 14
      }, CursorDirection.NEXT, (record) => {
        expect(record.name).toBe("Adam")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      return objectStore.forEach((record, id, key) => {
        expect(id).toBe(key)
        expect(id).toBeGreaterThan(10)
        
        return record.name === "Adam"
      }, CursorDirection.NEXT, (record) => {
        expect(record.name).toBe("Adam")
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(1)
      
      done()
    }).catch(error => fail(error.stack || error.message))
  })
  
  it("should be able to fetch all records matching a filter", (done) => {
    objectStore.getAll().then((records) => {
      expect(records).toEqual([
        {
          id: 11,
          name: "John"
        },
        {
          id: 14,
          name: "Adam"
        },
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      return objectStore.getAll(KeyRange.bound(11, 14))
    }).then((records) => {
      expect(records).toEqual([
        {
          id: 11,
          name: "John"
        },
        {
          id: 14,
          name: "Adam"
        }
      ])
      
      return objectStore.getAll({
        name: "Joshua"
      })
    }).then((records) => {
      expect(records).toEqual([
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      return objectStore.getAll((record, primaryKey) => {
        return primaryKey > 12
      }, CursorDirection.PREVIOUS)
    }).then((records) => {
      expect(records).toEqual([
        {
          id: 17,
          name: "Joshua"
        },
        {
          id: 14,
          name: "Adam"
        }
      ])
      
      done()
    })
  })
  
  it("should count the records matching a filter", (done) => {
    objectStore.count().then((count) => {
      expect(count).toEqual(3)
      
      return objectStore.count(KeyRange.bound(11, 14))
    }).then((count) => {
      expect(count).toEqual(2)
      
      return objectStore.count(14)
    }).then((count) => {
      expect(count).toEqual(1)
      
      return objectStore.count({
        name: "Joshua"
      })
    }).then((count) => {
      expect(count).toEqual(1)
      
      return objectStore.count(() => false)
    }).then((count) => {
      expect(count).toEqual(0)
      
      done()
    })
  })
  
  it("should test whether there is a matching record", (done) => {
    objectStore.exists(KeyRange.bound(11, 14)).then((exists) => {
      expect(exists).toBeTruthy()
      
      return objectStore.exists(KeyRange.lowerBound(24))
    }).then((exists) => {
      expect(exists).toBeFalsy()
      
      return objectStore.exists(record => record.name === "Adam")
    }).then((exists) => {
      expect(exists).toBeTruthy()
      
      done()
    })
  })
  
  it("should allow paging the records using the list method", (done) => {
    objectStore.list().then((recordList) => {
      expect(recordList.hasNextPage).toBeFalsy()
      expect(recordList.slice()).toEqual([
        {
          id: 11,
          name: "John"
        },
        {
          id: 14,
          name: "Adam"
        },
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      expect(() => {
        recordList.fetchNextPage()
      }).toThrow()
      
      transaction = database.startReadOnlyTransaction(
        OBJECT_STORE_NAME,
        OBJECT_STORE_NAME2
      )
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      return objectStore.list(undefined, CursorDirection.NEXT, 2)
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeTruthy()
      expect(recordList.slice()).toEqual([
        {
          id: 11,
          name: "John"
        },
        {
          id: 14,
          name: "Adam"
        }
      ])
      
      return transaction.completionPromise.then(() => recordList)
    }).then((recordList) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(recordList), 125)
      })
    }).then((recordList) => {
      return recordList.fetchNextPage()
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeFalsy()
      expect(recordList.slice()).toEqual([
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      expect(() => {
        recordList.fetchNextPage()
      }).toThrow()
      
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      return objectStore.list((record, primaryKey) => {
        return primaryKey > 12
      }, CursorDirection.PREVIOUS, 1)
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeTruthy()
      expect(recordList.slice()).toEqual([
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      return recordList.fetchNextPage()
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeFalsy()
      expect(recordList.slice()).toEqual([
        {
          id: 14,
          name: "Adam"
        }
      ])
      
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
      return objectStore.list(
        KeyRange.bound(14, 17),
        CursorDirection.PREVIOUS,
        1
      )
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeTruthy()
      expect(recordList.slice()).toEqual([
        {
          id: 17,
          name: "Joshua"
        }
      ])
      
      return recordList.fetchNextPage()
    }).then((recordList) => {
      expect(recordList.hasNextPage).toBeFalsy()
      expect(recordList.slice()).toEqual([
        {
          id: 14,
          name: "Adam"
        }
      ])
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
})
