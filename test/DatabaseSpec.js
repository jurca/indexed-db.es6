
import DBFactory from "../compiled/DBFactory"
import DatabaseSchema from "../compiled/schema/DatabaseSchema"
import ObjectStoreSchema from "../compiled/schema/ObjectStoreSchema"
import UpgradedDatabaseSchema from "../compiled/schema/UpgradedDatabaseSchema"

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
  
})
