
import DatabaseMigrator from "../../amd/migration/DatabaseMigrator"
import DatabaseSchema from "../../amd/schema/DatabaseSchema"
import DBFactory from "../../amd/DBFactory"
import PromiseSync from "../../amd/PromiseSync"
import ObjectStoreSchema from "../../amd/schema/ObjectStoreSchema"
import UpgradedDatabaseSchema from "../../amd/schema/UpgradedDatabaseSchema"

describe("DatabaseMigrator", () => {
  
  const DB_NAME = "testing database"
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = done
    request.onerror = () => fail(request.error)
  })
  
  function connect() {
    let request = indexedDB.open(DB_NAME)
    
    return new PromiseSync((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  function connectForUpgrade(version) {
    let request = indexedDB.open(DB_NAME, version)
    
    return new PromiseSync((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close()
        reject(new Error("no upgrade triggered"))
      }
      
      request.onupgradeneeded = () => {
        resolve(request)
      }
      
      request.onerror = (event) => {
        event.preventDefault()
      }
    })
  }
  
  it("should do nothing if the db version is the greatest described",
      (done) => {
    connectForUpgrade(2).then((request) => {
      let database = request.result
      let transaction = request.transaction
      
      let migrator = new DatabaseMigrator(database, transaction, [
        new DatabaseSchema(1, []),
        new UpgradedDatabaseSchema(2, [], [])
      ], 2)
      
      let executed = false
      migrator.executeMigration().then(() => {
        executed = true
      })
      
      expect(executed).toBeTruthy()
      
      return PromiseSync.resolve(request)
    }).then((database) => {
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should perform database creation and upgrade", (done) => {
    connectForUpgrade(2).then((request) => {
      let database = request.result
      let transaction = request.transaction
      
      let migrator = new DatabaseMigrator(database, transaction, [
        new DatabaseSchema(1,
          new ObjectStoreSchema("fooBar", null, false)
        ),
        new UpgradedDatabaseSchema(2, ["fooBar"], [
          new ObjectStoreSchema("fooBar2", null, false)
        ], (transaction, recordsMap) => {
          expect(recordsMap).toEqual({
            fooBar: []
          })
        })
      ], 0)
      
      return migrator.executeMigration().
          then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let objectStores = Array.from(database.objectStoreNames)
      expect(objectStores).toEqual(["fooBar2"])
      
      database.close()
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow data migration", (done) => {
    connectForUpgrade(1).then((request) => {
      let database = request.result
      let transaction = request.transaction
      
      let migrator = new DatabaseMigrator(database, transaction, [
        new DatabaseSchema(1,
          new ObjectStoreSchema("fooBar", null, true)
        )
      ], 0)
      
      return migrator.executeMigration().
          then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let transaction = database.transaction("fooBar", "readwrite")
      let objectStore = transaction.objectStore("fooBar")
      
      return new PromiseSync((resolve) => {
        objectStore.add("this is OK")
        objectStore.add("skip")
        objectStore.add("delete")
        objectStore.add({ someField: "this is also OK" })
        
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
      })
    }).then(() => connectForUpgrade(2)).then((request) => {
      let database = request.result
      let transaction = request.transaction
      
      let migrator = new DatabaseMigrator(database, transaction, [
        new DatabaseSchema(1,
          new ObjectStoreSchema("fooBar", null, true)
        ),
        new UpgradedDatabaseSchema(2, [
            {
              objectStore: "fooBar",
              preprocessor(record, key) {
                if (record === "skip") {
                  return UpgradedDatabaseSchema.SKIP_RECORD
                }
                if (record === "delete") {
                  return UpgradedDatabaseSchema.DELETE_RECORD
                }
                return record
              }
            }
          ], [
            new ObjectStoreSchema("fooBar")
          ], (transaction, records) => {
            expect(records).toEqual({
              fooBar: [
                { key: 1, record: "this is OK" },
                { key: 4, record: { someField: "this is also OK" } }
              ]
            })
            
            let objectStore = transaction.getObjectStore("fooBar")
            return PromiseSync.resolve(objectStore.add({
              anotherField: "another value"
            }))
          }
        )
      ], 1)
      
      return migrator.executeMigration().
          then(() => PromiseSync.resolve(request))
    }).then((database) => {
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      
      let request = objectStore.count()
      return PromiseSync.resolve(request).then((count) => ({
        database: database,
        count: count
      }))
    }).then((state) => {
      let { database, count } = state
      
      expect(count).toBe(4)
      
      let transaction = database.transaction("fooBar")
      let objectStore = transaction.objectStore("fooBar")
      
      let request = objectStore.get(5)
      return PromiseSync.resolve(request).then((record) => ({
        database: database,
        record: record
      }))
    }).then((state) => {
      let { database, record } = state
      
      expect(record).toEqual({ anotherField: "another value" })
      
      database.close()
    
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow usage of plain objects as schema descriptors", (done) => {
    DBFactory.open(DB_NAME, {
      version: 1,
      objectStores: [
        {
          name: "fooBar",
          keyPath: null,
          autoIncrement: true,
          indexes: [
            {
              name: "some index",
              keyPath: "id",
              unique: false,
              multiEntry: true
            }
          ]
        }
      ]
    }, {
      version: 2,
      fetchBefore: [],
      objectStores: [
        {
          name: "fooBar2"
        }
      ],
      after: () => {}
    }).then((database) => {
      database.close()
      done()
    }).catch(error => fail(error))
  })
  
})
