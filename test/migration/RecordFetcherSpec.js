
import RecordFetcher from "../../amd/migration/RecordFetcher"
import UpgradedDatabaseSchema from "../../amd/schema/UpgradedDatabaseSchema"

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
    fetcher.fetchRecords(DB_NAME, [
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
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow preprocessing records", (done) => {
    fetcher.fetchRecords(DB_NAME, [
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
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow skipping records", (done) => {
    fetcher.fetchRecords(DB_NAME, [
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
      
      return fetcher.fetchRecords(DB_NAME, [
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
      ])
    }).then((records) => {
      expect(records).toEqual({
        [STORE1]: [
          { key: 1, record: "a" },
          { key: 2, record: "b" }
        ],
        [STORE2]: [
          { key: 1, record: "x" }
        ]
      })
      
      done()
    }).catch(error => fail(error))
  })
  
  it("should allow deleting records", (done) => {
    fetcher.fetchRecords(DB_NAME, [
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
      
      return fetcher.fetchRecords(DB_NAME, [
        {
          objectStore: STORE1,
          preprocessor: (record => record)
        },
        {
          objectStore: STORE2,
          preprocessor: (record => record)
        }
      ])
    }).then((records) => {
      expect(records).toEqual({
        [STORE1]: [
          { key: 1, record: "a" }
        ],
        [STORE2]: [
        ]
      })
      
      done()
    }).catch(error => fail(error))
  })
  
})
