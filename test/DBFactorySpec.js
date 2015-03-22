
import DBFactory from "../compiled/DBFactory"
import DatabaseSchema from "../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../compiled/schema/ObjectStoreSchema"

describe("DBFactory", () => {

  const DB_NAME = "testing database"

  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => done(request.error)
  })

  it("should connect to an existing database", (done) => {
    let request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => done(request.error)
    request.onblocked = () => done(new Error("failed to create the database"))
    request.onupgradeneeded = () => {
      let database = request.result
      database.onerror = done
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
      }).catch((error) => done(error))

      done()
    }
  })
})
