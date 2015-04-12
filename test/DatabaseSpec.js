
import DBFactory from "../dist/DBFactory"
import DatabaseSchema from "../dist/schema/DatabaseSchema"
import ObjectStoreSchema from "../dist/schema/ObjectStoreSchema"
import UpgradedDatabaseSchema from "../dist/schema/UpgradedDatabaseSchema"

describe("Database", () => {
  
  const DB_NAME = "testing database"
  
  let database
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema("fooBar")
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      done()
    }).catch((error) => fail(error))
  })
  
  afterEach((done) => {
    database.close()
    
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("allows version change request to be listened for", (done) => {
    var listenerExecuted = false
    
    database.addVersionChangeListener((newVersion) => {
      expect(newVersion).toBe(77)
      listenerExecuted = true
      
      database.close()
    })
    
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema("fooBar")
      ),
      new UpgradedDatabaseSchema(77, [], [
        new ObjectStoreSchema("fooBar2")
      ])
    ).then((databaseInstance) => {
      databaseInstance.close()
      
      expect(listenerExecuted).toBeTruthy()
      
      done()
    }).catch((error) => fail(error))
  })
  
  it("blocks schema upgrade if no version change listener exists", (done) => {
    database.addVersionChangeListener((newVersion) => {
      expect(newVersion).toBe(14)
    })
    
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema("fooBar")
      ),
      new UpgradedDatabaseSchema(14, [], [
        new ObjectStoreSchema("fooBar2")
      ])
    ).then((databaseInstance) => {
      fail("the database connection should have been rejected")
    }).catch((error) => {
      done()
    })
  })
  
  it("creates read-write transactions", (done) => {
    let transaction = database.startTransaction("fooBar")
    let objectStore = transaction.getObjectStore("fooBar")
    
    objectStore.add(undefined, 123).then((key) => {
      expect(key).toBe(123)
      
      return transaction.completionPromise
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
  it("creates read-only transactions", (done) => {
    let transaction = database.startReadOnlyTransaction("fooBar")
    let objectStore = transaction.getObjectStore("fooBar")
    
    objectStore.count().then((count) => {
      expect(count).toBe(0)
      
      return transaction.completionPromise
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
  it("creates a single-object store read-only transactions", (done) => {
    let objectStore = database.getObjectStore("fooBar")
    
    objectStore.count().then((count) => {
      expect(count).toBe(0)
    }).then(() => {
      done()
    }).catch(error => fail(error))
  })
  
  it("allows specifying object stores for transaction in an array", (done) => {
    database.startTransaction(["fooBar"]).completionPromise.then(() => {
      return database.startReadOnlyTransaction(["fooBar"]).completionPromise
    }).then(() => {
      done()
    })
  })
  
  it("should ran a read-only transaction", (done) => {
    database.runReadOnlyTransaction("fooBar", (fooBar) => {
      return fooBar.count()
    }).then((count) => {
      expect(count).toBe(0)
      
      done()
    })
  })
  
  it("should ran a read-write transaction", (done) => {
    database.runTransaction("fooBar", (fooBar) => {
      return fooBar.add("a", 1).then(
        () => fooBar.add("b", 2)
      ).then(
        () => fooBar.add("c", 3)
      )
    }).then(() => {
      return database.runTransaction(["fooBar"], (fooBar) => {
        return fooBar.count()
      })
    }).then((count) => {
      expect(count).toBe(3)
      
      done()
    })
  })
  
})
