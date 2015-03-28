
import DBFactory from "../compiled/DBFactory"
import DatabaseSchema from "../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../compiled/schema/ObjectStoreSchema"

describe("DBFactory", () => {

  const DB_NAME = "testing database"

  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })

  it("should connect to an existing database", (done) => {
    let request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail(new Error("failed to create the database"))
    request.onupgradeneeded = () => {
      let database = request.result
      database.onerror = fail
      database.createObjectStore("testingStore")
    }

    request.onsuccess = () => {
      let database = request.result
      database.close()

      DBFactory.open(DB_NAME,
        new DatabaseSchema(1,
          new ObjectStoreSchema("testingStore", null, false)
        )
      ).then((database) => {
        database.close()
        done()
      }).catch((error) => fail(error))
    }
  })
})
