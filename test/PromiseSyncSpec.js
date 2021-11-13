
import PromiseSync from "../es2015/PromiseSync.js"

describe("PromiseSync", () => {
  
  it("should execute initialization callback correctly", () => {
    let callbackExecuted = false
    
    new PromiseSync((resolve, reject) => {
      callbackExecuted = true
      expect(resolve instanceof Function).toBeTruthy()
      expect(reject instanceof Function).toBeTruthy()
    })
    
    expect(callbackExecuted).toBeTruthy()
  })
  
  it("should execute success callback synchronously", () => {
    let executed = false
    
    new PromiseSync((resolve) => {
      resolve(123)
    }).then((number) => {
      executed = true
      expect(number).toBe(123)
    })
    
    expect(executed).toBeTruthy()
  })
  
  it("should execute error callback synchronously", () => {
    let executed = false
    
    new PromiseSync((resolve, reject) => {
      reject(new Error("hello"))
    }).then(null, (error) => {
      executed = true
      expect(error instanceof Error).toBeTruthy()
      expect(error.message).toBe("hello")
    })
    
    expect(executed).toBeTruthy()
  })
  
  it("should reject if initialization callback throws an error", () => {
    new PromiseSync(() => {
      throw new Error("hello")
    }).then(null, (error) => {
      expect(error instanceof Error).toBeTruthy()
      expect(error.message).toBe("hello")
    })
  })
  
  it("should allow providing error handler using the catch method", () => {
    let executed = false
    
    new PromiseSync(() => {
      throw new Error("hello")
    }).catch((error) => {
      executed = true
      expect(error instanceof Error).toBeTruthy()
      expect(error.message).toBe("hello")
    })
    
    expect(executed).toBeTruthy()
  })
  
  it("should execute success callback synchronously when resolved " +
      "asynchronously", (done) => {
    let started = false
    let executed = false
    
    new PromiseSync((resolve) => {
      setTimeout(() => {
        started = true
        
        setTimeout(() => {
          executed = false
          
          done()
        }, 0)
        
        resolve()
        expect(executed).toBeTruthy()
      }, 0)
    }).then(() => {
      executed = true
    }).then(() => {
      expect(executed).toBeTruthy()
    })
    
    expect(started).toBeFalsy()
    expect(started).toBeFalsy()
  })
  
  it("should execute error callback synchronously when rejected " +
      "asynchronously", (done) => {
    let started = false
    let executed = false
    
    new PromiseSync((resolve, reject) => {
      setTimeout(() => {
        started = true
        
        setTimeout(() => {
          executed = false
          
          done()
        }, 0)
        
        reject()
        expect(executed).toBeTruthy()
      }, 0)
    }).catch(() => {
      executed = true
    }).then(() => {
      expect(executed).toBeTruthy()
    })
    
    expect(started).toBeFalsy()
    expect(started).toBeFalsy()
  })
  
  it("should allow converting to a Promise/A+ promise", (done) => {
    let executedSync = false
    let executedAsync = false
    
    new PromiseSync((resolve) => {
      resolve()
    }).then(() => {
      executedSync = true
    }).toPromise().then(() => {
      executedAsync = true
      
      done()
    })
    
    expect(executedSync).toBeTruthy()
    expect(executedAsync).toBeFalsy()
  })
  
  it("should resolve synchronous promises to themselves", () => {
    let promise = new PromiseSync()
    
    expect(PromiseSync.resolve(promise)).toBe(promise)
  })
  
  it("should resolve Promise/A+ promises to synchronous promises", (done) => {
    let resolver
    
    PromiseSync.resolve(new Promise((resolve) => {
      resolver = resolve
    })).then((value) => {
      expect(value).toBe(123)
      
      done()
    })
    
    resolver(123)
  })
  
  it("should synchronously resolve values", () => {
    let executed = false
    
    PromiseSync.resolve("something").then(() => {
      executed = true
    })
    
    expect(executed).toBeTruthy()
  })
  
  it("should reject synchronously", () => {
    let executed = false
    
    PromiseSync.reject(new Error("fooBar")).catch(() => {
      executed = true
    })
    
    expect(executed).toBeTruthy()
  })
  
  it(".all() should wait for all promises to be resolved", () => {
    let executed = false
    let resolvers = []
    
    PromiseSync.all([
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      }),
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      }),
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      })
    ]).then((values) => {
      executed = true
      expect(values).toEqual([1, 2, 3])
    })
    
    expect(executed).toBeFalsy()
    resolvers[2](3)
    expect(executed).toBeFalsy()
    resolvers[0](1)
    expect(executed).toBeFalsy()
    resolvers[1](2)
    expect(executed).toBeTruthy()
  })
  
  it(".all() should reject the moment any promise rejects", () => {
    let executed = false
    let resolvers = []
    let rejector
    
    PromiseSync.all([
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      }),
      new PromiseSync((resolve, reject) => {
        resolvers.push(resolve)
        rejector = reject
      }),
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      })
    ]).catch(() => {
      executed = true
    })
    
    expect(executed).toBeFalsy()
    resolvers[0]()
    expect(executed).toBeFalsy()
    rejector()
    expect(executed).toBeTruthy()
  })
  
  it(".race() should resolve the moment any promise resolves", () => {
    let executed = false
    let resolvers = []
    
    PromiseSync.race([
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      }),
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      }),
      new PromiseSync((resolve) => {
        resolvers.push(resolve)
      })
    ]).then((value) => {
      executed = true
      expect(value).toBe(2)
    })
    
    expect(executed).toBeFalsy()
    resolvers[1](2)
    expect(executed).toBeTruthy()
  })
  
  it(".race() should reject the moment any promise rejects", () => {
    let executed = false
    let rejector
    
    PromiseSync.race([
      new PromiseSync(() => {
      }),
      new PromiseSync((resolve, reject) => {
        rejector = reject
      }),
      new PromiseSync(() => {
      })
    ]).catch(() => {
      executed = true
    })
    
    expect(executed).toBeFalsy()
    rejector()
    expect(executed).toBeTruthy()
  })
  
  it("cannot be resolved repeatedly", () => {
    let resolver
    let resolveCount = 0
    
    new PromiseSync((resolve) => {
      resolver = resolve
    }).then(() => {
      resolveCount++
    })
    
    expect(resolveCount).toBe(0)
    resolver()
    expect(resolveCount).toBe(1)
    resolver()
    expect(resolveCount).toBe(1)
  })
  
  it("cannot be rejected repeatedly", () => {
    let rejector
    let rejectCount = 0
    
    new PromiseSync((resolve, reject) => {
      rejector = reject
    }).catch(() => {
      rejectCount++
    })
    
    expect(rejectCount).toBe(0)
    rejector()
    expect(rejectCount).toBe(1)
    rejector()
    expect(rejectCount).toBe(1)
  })
  
  it("should handle returned sync promises", () => {
    let initResolver
    let resolver
    let executed = false
    
    new PromiseSync((resolve) => {
      initResolver = resolve
    }).then(() => {
      return new PromiseSync((resolve) => {
        resolver = resolve
      })
    }).then((val) => {
      executed = true
      expect(val).toBe(123)
    })
    
    expect(executed).toBeFalsy()
    initResolver()
    expect(executed).toBeFalsy()
    resolver(123)
    expect(executed).toBeTruthy()
  })
  
  it("should be suitable for wrapping Indexed DB requests", (done) => {
    let database
    let transaction
    let objectStore
    let request
    
    request = indexedDB.deleteDatabase("testing database")
    PromiseSync.resolve(request).then(() => {
      return connect()
    }).then((db) => {
      database = db
      transaction = db.transaction("foo", "readwrite")
      objectStore = transaction.objectStore("foo")
      
      return PromiseSync.resolve(objectStore.add("abc"))
    }).then((key) => {
      expect(key).toBe(1)
      
      return PromiseSync.resolve(objectStore.add("def"))
    }).then((key) => {
      expect(key).toBe(2)
      
      return new PromiseSync((resolve) => {
        transaction.oncomplete = () => resolve()
      })
    }).then(() => {
      transaction = database.transaction("foo")
      objectStore = transaction.objectStore("foo")
      request = objectStore.openCursor()
      
      return PromiseSync.resolve(request)
    }).then((cursor) => {
      expect(cursor.value).toBe("abc")
      cursor.continue()
      
      return PromiseSync.resolve(request)
    }).then((cursor) => {
      expect(cursor.value).toBe("def")
      cursor.continue()
      
      return PromiseSync.resolve(request)
    }).then((cursor) => {
      expect(cursor).toBeNull()
      
      return new PromiseSync((resolve) => {
        transaction.oncomplete = () => resolve()
      })
    }).then(() => {
      database.close()
      
      return PromiseSync.resolve(indexedDB.deleteDatabase("testing database"))
    }).then(() => {
      done()
    }).catch((error) => {
      fail(error)
    })
  })
  
  function connect() {
    return new PromiseSync((resolve, reject) => {
      let request = indexedDB.open("testing database")
      
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = () => {
        let db = request.result
        
        db.createObjectStore("foo", {
          autoIncrement: true
        })
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }
  
})
