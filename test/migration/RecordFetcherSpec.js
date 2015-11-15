
import RecordFetcher from "../../es6/migration/RecordFetcher"
import UpgradedDatabaseSchema from "../../es6/schema/UpgradedDatabaseSchema"

describe("RecordFetcher", () => {
  
  const DB_NAME = "testing database"
  const STORE1 = "first store"
  const STORE2 = "second store"
  
  let fetcher = new RecordFetcher()
  
  beforeEach((done) => {
    let request = indexedDB.open(DB_NAME)
    
    request.onupgradeneeded = () => {
      let database = request.result
      database.createObjectStore(STORE1, { autoIncrement: true })
      database.createObjectStore(STORE2, { autoIncrement: true })
    }
    
    request.onsuccess = () => {
      let database = request.result
      database.onerror = (error) => fail(error)
      
      let transaction = database.transaction([STORE1, STORE2], "readwrite")
      
      let objectStore = transaction.objectStore(STORE1)
      objectStore.add("a")
      objectStore.add("b")
      objectStore.add("c")
      objectStore.add("d")
      objectStore = transaction.objectStore(STORE2)
      objectStore.add("x")
      objectStore.add("y")
      objectStore.add("z")
      
      transaction.oncomplete = () => {
        database.close()
        done()
      }
    }
    
    request.onerror = () => fail(request.error)
  })
  
  afterEach((done) => {
    let request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => done()
    request.onerror = () => fail(request.error)
  })
  
  it("should fetch the records", (done) => {
    openConnection().then((database) => {
      let transaction = database.transaction([STORE1, STORE2])
      
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: (record => record)
        },
        {
          objectStore: STORE2,
          preprocessor: (record => record)
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 1, record: "a" },
            { key: 2, record: "b" },
            { key: 3, record: "c" },
            { key: 4, record: "d" }
          ],
          [STORE2]: [
            { key: 1, record: "x" },
            { key: 2, record: "y" },
            { key: 3, record: "z" }
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      database.close()
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow preprocessing records", (done) => {
    openConnection().then((database) => {
      let transaction = database.transaction(STORE1)
    
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: ((record, primaryKey) => {
            return record + primaryKey
          })
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 1, record: "a1" },
            { key: 2, record: "b2" },
            { key: 3, record: "c3" },
            { key: 4, record: "d4" }
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      database.close()
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow skipping records", (done) => {
    openConnection().then((database) => {
      let transaction = database.transaction(STORE1)
      
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: ((record, primaryKey) => {
            if (primaryKey < 3) {
              return UpgradedDatabaseSchema.SKIP_RECORD
            }
            
            return record
          })
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 3, record: "c" },
            { key: 4, record: "d" }
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      let transaction = database.transaction([STORE1, STORE2])
      
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: ((record, primaryKey) => {
            if (primaryKey > 2) {
              return UpgradedDatabaseSchema.SKIP_RECORD
            }
            
            return record
          })
        },
        {
          objectStore: STORE2,
          preprocessor: ((record, primaryKey) => {
            if (primaryKey > 1) {
              return UpgradedDatabaseSchema.SKIP_RECORD
            }
            
            return record
          })
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 1, record: "a" },
            { key: 2, record: "b" }
          ],
          [STORE2]: [
            { key: 1, record: "x" }
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      database.close()
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow deleting records", (done) => {
    openConnection().then((database) => {
      let transaction = database.transaction([STORE1, STORE2], "readwrite")
      
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: ((record, primaryKey) => {
            if (primaryKey > 1) {
              return UpgradedDatabaseSchema.DELETE_RECORD
            }
            
            return record
          })
        },
        {
          objectStore: STORE2,
          preprocessor: ((record, primaryKey) => {
            return UpgradedDatabaseSchema.DELETE_RECORD
          })
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 1, record: "a" }
          ],
          [STORE2]: [
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      let transaction = database.transaction([STORE1, STORE2], "readwrite")
      
      return fetcher.fetchRecords(transaction, [
        {
          objectStore: STORE1,
          preprocessor: (record => record)
        },
        {
          objectStore: STORE2,
          preprocessor: (record => record)
        }
      ]).then((records) => {
        expect(records).toEqual({
          [STORE1]: [
            { key: 1, record: "a" }
          ],
          [STORE2]: [
          ]
        })
      }).toPromise().then(() => database)
    }).then((database) => {
      database.close()
      done()
    }).catch(error => fail(error))
  })
  
  function openConnection() {
    let request = indexedDB.open(DB_NAME)
    
    return new Promise((resolve, reject) => {
      // Note: the "blocked" event cannot occurr since we're not upgrading an
      // existing database
      
      request.onsuccess = () => {
        let database = request.result
        resolve(database)
      }
      
      request.onupgradeneeded = () => {
        request.transaction.abort()
        reject(new Error(`The database ${request.result.name} does not exist`))
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }
  
})
