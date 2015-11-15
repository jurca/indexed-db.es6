
import PromiseSync from "../../es6/PromiseSync"
import ObjectStoreMigrator from "../../es6/migration/ObjectStoreMigrator"
import IndexSchema from "../../es6/schema/IndexSchema"
import ObjectStoreSchema from "../../es6/schema/ObjectStoreSchema"

describe("ObjectStoreMigrator", () => {
  
  const DB_NAME = "testing database"
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = done
    request.onerror = () => fail(request.error)
  })
  
  function connectForUpgrade() {
    return new PromiseSync((resolve, reject) => {
      let request = indexedDB.open(DB_NAME, 1)
      request.onerror = reject
      request.onblocked = reject
      request.onupgradeneeded = () => {
        resolve({
          database: request.result,
          transaction: request.transaction,
          request: request
        })
      }
    })
  }
  
  it("should create new object store", (done) => {
    connectForUpgrade().then((connection) => {
      let { database, transaction, request } = connection
      
      let migrator = new ObjectStoreMigrator(database, null,
        new ObjectStoreSchema("fooBar", null, true,
          new IndexSchema("my index", ["some.key", "other.deep.field", "abc"])
        )
      )
      
      migrator.executeMigration()
      
      return new PromiseSync((resolve) => {
        request.onsuccess = () => resolve(request.result)
      })
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      let index = objectStore.index("my index")
        
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should create, delete and update indexes", (done) => {
    connectForUpgrade().then((connection) => {
      let { database, transaction, request } = connection
      
      let objectStore = database.createObjectStore("fooBar")
      objectStore.createIndex("index to remove", "id")
      objectStore.createIndex("change key paths", "id2")
      objectStore.createIndex("change key paths 2", ["id2", "id3"])
      objectStore.createIndex("change key paths 3", ["id2", "id4"])
      objectStore.createIndex("change unique 1", "id3", { unique: false })
      objectStore.createIndex("change unique 2", "id4", { unique: true })
      objectStore.createIndex("change multi 1", "a", { multiEntry: false })
      objectStore.createIndex("change multi 2", "b", { multiEntry: true })
      
      let migrator = new ObjectStoreMigrator(database, objectStore,
        new ObjectStoreSchema("fooBar", null, false,
          new IndexSchema("index to create", "id0"),
          new IndexSchema("change key paths", ["id2", "id0"]),
          new IndexSchema("change key paths 2", "id9"),
          new IndexSchema("change key paths 3", ["id3", "id4"]),
          new IndexSchema("change unique 1", "id3", true),
          new IndexSchema("change unique 2", "id4", false),
          new IndexSchema("change multi 1", "a", false, true),
          new IndexSchema("change multi 2", "b", false, false)
        )
      )
      
      migrator.executeMigration()
      
      return new PromiseSync((resolve) => {
        request.onsuccess = () => resolve(request.result)
      })
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      
      let indexNames = Array.from(objectStore.indexNames)
      expect(indexNames).not.toContain("index to remove")
      expect(indexNames).toContain("index to create")
      
      let index = objectStore.index("change key paths")
      expect(Array.from(index.keyPath)).toEqual(["id2", "id0"])
      index = objectStore.index("change key paths 2")
      expect(index.keyPath).toBe("id9")
      index = objectStore.index("change key paths 3")
      expect(Array.from(index.keyPath)).toEqual(["id3", "id4"])
      
      expect(objectStore.index("change unique 1").unique).toBe(true)
      expect(objectStore.index("change unique 2").unique).toBe(false)
      
      expect(objectStore.index("change multi 1").multiEntry).toBe(true)
      expect(objectStore.index("change multi 2").multiEntry).toBe(false)
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
})
