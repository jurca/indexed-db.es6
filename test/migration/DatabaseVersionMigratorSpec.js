
import PromiseSync from "../../es2015/PromiseSync.js"
import DatabaseVersionMigrator
    from "../../es2015/migration/DatabaseVersionMigrator.js"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema.js"
import IndexSchema from "../../es2015/schema/IndexSchema.js"

describe("DatabaseVersionMigrator", () => {
  
  const DB_NAME = "testing database"
  const SCHEMA_V1 = [
    new ObjectStoreSchema("fooBar", "", true,
      new IndexSchema("someIndex", "keyed", true)
    ),
    new ObjectStoreSchema("fooBar2", null, true)
  ]
  const SCHEMA_V2 = [
    new ObjectStoreSchema("fooBar", null, true),
    new ObjectStoreSchema("fooBar3", null, true,
      new IndexSchema("someIndex", "keyed", true)
    )
  ]
  
  beforeEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("should create new database", (done) => {
    connectForUpgrade(1).then((request) => {
      return createDatabase(request).then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let objectStores = Array.from(database.objectStoreNames)
      
      expect(objectStores).toEqual(["fooBar", "fooBar2"])
      
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      let indexes = Array.from(objectStore.indexNames)
      expect(indexes).toEqual(["someIndex"])
      
      let index = objectStore.index("someIndex")
      expect(index.unique).toBeTruthy()
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should upgrade existing db schema", (done) => {
    connectForUpgrade(1).then((request) => {
      return createDatabase(request).then(() => request)
    }).then((request) => {
      return upgradeDatabase(request, () => {}, {}).
          then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let objectStores = Array.from(database.objectStoreNames)
      
      expect(objectStores).toEqual(["fooBar", "fooBar3"])
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should execute completion callback", (done) => {
    let callbackExecuted = false
    
    connectForUpgrade(1).then((request) => {
      return createDatabase(request).then(() => request)
    }).then((request) => {
      return upgradeDatabase(request, (transaction, data) => {
        expect(data).toEqual({ some: ["stuff"] })
        
        callbackExecuted = true
      }, {
        some: ["stuff"]
      }).then(() => PromiseSync.resolve(request))
    }).then((database) => {
      database.close()
      expect(callbackExecuted).toBeTruthy()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow completion callback to modify data", (done) => {
    connectForUpgrade(1).then((request) => {
      return createDatabase(request).then(() => request)
    }).then((request) => {
      return upgradeDatabase(request, (transaction) => {
        let objectStore = transaction.getObjectStore("fooBar")
        
        return objectStore.add({ keyed: "abc" }).then(() => {
          return objectStore.add({ keyed: "def" })
        }).then(() => {
          return objectStore.add({ keyed: "ghi" })
        })
      }).then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      let request = objectStore.count()
      
      return new PromiseSync.resolve(request).then((recordCount) => {
        database.close()
        return recordCount
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should execute the callback within the versionchange transaction",
      (done) => {
    let database = null
    let transaction = null
    connectForUpgrade(2).then((request) => {
      return createDatabase(request).then(() => request)
    }).then((request) => {
      database = request.result
      transaction = request.transaction
      
      return upgradeDatabase(request, (transaction) => {
        transaction.completionPromise.catch(() => {})
        let objectStore = transaction.getObjectStore("fooBar3")
        objectStore.add({ keyed: "abc" })
        return objectStore.add({ keyed: "abc" })
      })
    }).then(() => {
      fail("the transaction should have failed")
    }).catch((error) => {
      transaction.abort()
      database.close()
      
      return openConnection()
    }).then((database) => {
      expect(database.version).toBe(1)
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should cancel versionchange transaction on early error", (done) => {
    let database = null
    let transaction = null
    
    connectForUpgrade(2).then((request) => {
      return createDatabase(request).then(() => request)
    }).then((request) => {
      database = request.result
      transaction = request.transaction
      
      return upgradeDatabase(request, (transaction) => {
        let objectStore = transaction.getObjectStore("fooBar")
        return objectStore.add({ keyed: "abc" }, /invalid key/)
      })
    }).then(() => {
      fail("the transaction should have failed")
    }).catch((error) => {
      transaction.abort()
      database.close()
      
      return openConnection()
    }).then((database) => {
      expect(database.version).toBe(1)
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  function upgradeDatabase(request, callback, data) {
    let migrator = new DatabaseVersionMigrator(
      request.result,
      request.transaction,
      SCHEMA_V2
    )
    
    return migrator.executeMigration(callback, data)
  }
  
  function createDatabase(request) {
    let migrator = new DatabaseVersionMigrator(
      request.result,
      request.transaction,
      SCHEMA_V1
    )
    
    return migrator.executeMigration(() => {}, {})
  }
  
  function connectForUpgrade(version) {
    let request = indexedDB.open(DB_NAME, version)
    
    return new PromiseSync((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close()
        reject(new Error("No upgrade triggered"))
      }
      
      request.onupgradeneeded = () => {
        resolve(request)
      }
      
      request.onblocked = () => reject(new Error("blocked"))
      
      request.onerror = (event) => {
        event.preventDefault()
        reject(request.error)
      }
    })
  }

  function openConnection() {
    let request = indexedDB.open(DB_NAME)
    
    return new PromiseSync((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onerror = (event) => {
        event.preventDefault()
        reject(request.error)
      }
    })
  }
  
})
