
import DBFactory from "../../es2015/DBFactory"
import DatabaseSchema from "../../es2015/schema/DatabaseSchema"
import ObjectStoreSchema from "../../es2015/schema/ObjectStoreSchema"

describe("ReadOnlyTransaction", () => {
  
  const DB_NAME = "testing database"
  const OBJECT_STORE_NAME = "fooBar"
  
  let database
  let transaction
  
  beforeEach((done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME)
      )
    ).then((databaseInstance) => {
      database = databaseInstance
      transaction = database.startReadOnlyTransaction(OBJECT_STORE_NAME)
      done()
    }).catch((error) => fail(error))
  })
  
  afterEach((done) => {
    database.close()
    
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("should provide promise resolved on completion", (done) => {
    transaction.completionPromise.
        then(done).
        catch(error => fail(error))
  })
  
  it("should provide promise rejected on abort", (done) => {
    transaction.completionPromise.then(() => {
      fail("The transaction cannot complete if aborted")
      done()
    }).catch((error) => {
      expect(error.name).toBe("AbortError")
      done()
    })
        
    transaction.abort()
  })
  
  it("should provide promise rejected on error", (done) => {
    let transaction = database.startTransaction(OBJECT_STORE_NAME)
    transaction.completionPromise.
        then(() => fail("The transaction cannot complete if error occurrs")).
        catch(() => done())
    
    let objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
    objectStore.add(null, 1).then(() => {
      objectStore.add(null, 1).
          catch(() => {})
    })
  })
  
  it("should execute completion listeners", (done) => {
    transaction.addCompleteListener(() => done())
  })
  
  it("should execute abort listeners on abort", (done) => {
    transaction.addAbortListener(() => done())
    transaction.completionPromise.catch(() => {})
    
    transaction.abort()
  })
  
  it("should execute error listeners on error", (done) => {
    let transaction = database.startTransaction(OBJECT_STORE_NAME)
    transaction.addErrorListener(() => done())
    transaction.completionPromise.catch(() => {})
    
    let objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
    objectStore.add(null, 1).then(() => {
      objectStore.add(null, 1).
          catch(() => {})
    })
  })
  
  it("it should provide access to object stores", (done) => {
    let objectStore = transaction.getObjectStore(OBJECT_STORE_NAME)
    
    objectStore.count().then((count) => {
      expect(count).toBe(0)
      done()
    }).catch(error => fail(error))
  })
  
})
