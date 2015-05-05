
import DatabaseVersionMigrator
    from "../../dist/migration/DatabaseVersionMigrator"
import ObjectStoreSchema from "../../dist/schema/ObjectStoreSchema"
import IndexSchema from "../../dist/schema/IndexSchema"

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
    createDatabase().then(() => {
      return openConnection()
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
    createDatabase().then(() => {
      return upgradeDatabase(() => {}, {})
    }).then(() => {
      return openConnection()
    }).then((database) => {
      let objectStores = Array.from(database.objectStoreNames)
      
      expect(objectStores).toEqual(["fooBar", "fooBar3"])
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should reject modifying schema if database is of the target version",
      (done) => {
    createDatabase().then(() => {
      return createDatabase()
    }).then(() => {
      fail("the version migrator should have rejected")
    }).catch(error => {
      done()
    })
  })
  
  it("should execute completion callback", (done) => {
    let callbackExecuted = false
    
    createDatabase().then(() => {
      return upgradeDatabase((transaction, data) => {
        expect(data).toEqual({ some: ["stuff"] })
        
        callbackExecuted = true
      }, {
        some: ["stuff"]
      })
    }).then(() => {
      expect(callbackExecuted).toBeTruthy()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow completion callback to modify data", (done) => {
    createDatabase().then(() => {
      return upgradeDatabase((transaction) => {
        let objectStore = transaction.getObjectStore("fooBar")
        
        return objectStore.add({ keyed: "abc" }).then(() => {
          return objectStore.add({ keyed: "def" })
        }).then(() => {
          return objectStore.add({ keyed: "ghi" })
        })
      })
    }).then(() => {
      return openConnection()
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      let request = objectStore.count()
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result)
          database.close()
        }
        request.onerror = () => reject(request.error)
      })
    }).then((recordCount) => {
      expect(recordCount).toBe(3)
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should execute the callback within the versionchange transaction",
      (done) => {
    createDatabase().then(() => {
      return upgradeDatabase((transaction) => {
        let objectStore = transaction.getObjectStore("fooBar3")
        objectStore.add({ keyed: "abc" })
        return objectStore.add({ keyed: "abc" })
      })
    }).then(() => {
      fail("the transaction should have failed")
    }).catch((error) => {
      return openConnection()
    }).then((database) => {
      expect(database.version).toBe(1)
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should cancel versionchange transaction on early error", (done) => {
    createDatabase().then(() => {
      return upgradeDatabase((transaction) => {
        let objectStore = transaction.getObjectStore("fooBar")
        return objectStore.add({ keyed: "abc" }, /invalid key/)
      })
    }).then(() => {
      fail("the transaction should have failed")
    }).catch((error) => {
      return openConnection()
    }).then((database) => {
      expect(database.version).toBe(1)
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  function upgradeDatabase(callback, data) {
    let migrator = new DatabaseVersionMigrator(
      DB_NAME,
      2,
      SCHEMA_V2
    )
    
    return migrator.executeMigration(callback, data)
  }
  
  function createDatabase() {
    let migrator = new DatabaseVersionMigrator(
      DB_NAME,
      1,
      SCHEMA_V1
    )
    
    return migrator.executeMigration(() => {}, {})
  }

  function openConnection() {
    let request = indexedDB.open(DB_NAME)
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }
  
})
