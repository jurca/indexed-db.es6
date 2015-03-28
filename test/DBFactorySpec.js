
import DBFactory from "../compiled/DBFactory"
import DatabaseSchema from "../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../compiled/schema/ObjectStoreSchema"

describe("DBFactory", () => {

  const DB_NAME = "testing database"
  const NONEXISTING_DB_NAME = "nonexisting database"
  const OBJECT_STORE_NAME = "testingStore"

  beforeEach((done) => {
    let request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail("failed to create the database")
    
    request.onupgradeneeded = () => {
      let database = request.result
      database.onerror = fail
      database.createObjectStore(OBJECT_STORE_NAME)
    }

    request.onsuccess = () => {
      let database = request.result
      database.close()

      done()
    }
  })

  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => {
      let request = indexedDB.deleteDatabase(NONEXISTING_DB_NAME)
      request.onsuccess = done
      request.onerror = () => fail(request.error)
    }
    request.onerror = () => fail(request.error)
  })

  it("should connect to an existing database", (done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, null, false)
      )
    ).then((database) => {
      database.close()
      done()
    }).catch((error) => fail(error))
  })
  
  it("should delete an existing database", (done) => {
    DBFactory.deleteDatabase(DB_NAME).then((deletedVersion) => {
      expect(deletedVersion).toBe(1)
      done()
    }).catch(fail)
  })
  
  it("should trigger creation of a non-existing database", (done) => {
    DBFactory.open(NONEXISTING_DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, null, false)
      )
    ).then((database) => {
      database.close()
      done()
    }).catch((error) => fail(error))
  })
  
  it("should trigger schema upgrade of an outdated database", (done) => {
    DBFactory.open(DB_NAME,
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, null, false)
      ),
      new DatabaseSchema(1,
        new ObjectStoreSchema(OBJECT_STORE_NAME, null, false),
        new ObjectStoreSchema("some other object store", null, false)
      )
    ).then((database) => {
      database.close()
      done()
    }).catch((error) => fail(error))
  })
})
