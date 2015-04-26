
import KeepAlive from "../../dist/transaction/KeepAlive"

describe("KeepAlive", () => {
  
  let keepAlive
  let monitor
  let lastRequest
  
  keepAlive = new KeepAlive(() => objectStore, 50)
  let nativeMonitorMethod = keepAlive.requestMonitor.monitor
  
  beforeEach(() => {
    let objectStore
    keepAlive = new KeepAlive(() => objectStore, 50)
    monitor = keepAlive.requestMonitor
    objectStore = new ObjectStore(monitor)
    
    monitor.constructor.prototype.monitor = (request) => {
      if (!request.currentMonitor || (request.currentMonitor === monitor)) {
        lastRequest = request
      }
      return nativeMonitorMethod.call(monitor, request)
    }
    
    lastRequest = null
  })
  
  afterEach(() => {
    keepAlive.terminate()
  })
  
  it("does not send keep-alive requests before the first client request",
      (done) => {
    setTimeout(() => {
      expect(lastRequest).toBeNull()
      
      monitor.monitor(new Request({}, 10)).then(() => {
        setTimeout(() => {
          expect(lastRequest.isKeepAlive).toBeTruthy()
          
          done()
        }, 10)
      })
    }, 100)
  })
  
  it("sends a keep-alive request by the time the promise then callback is " +
      "called", (done) => {
    monitor.monitor(new Request({}, 10)).then(() => {
      expect(lastRequest.isKeepAlive).toBeTruthy()
      
      done()
    })
  })
  
  it("keeps sending keep-alive requests until commit delay expires",
      (done) => {
    monitor.monitor(new Request({ foo: "bar" }, 0))
    setTimeout(() => {
      expect(lastRequest.isKeepAlive).toBeTruthy()
      expect(Date.now() - lastRequest.created).toBeLessThan(20)
      
      setTimeout(() => {
        expect(Date.now() - lastRequest.created).toBeLessThan(30)
        
        done()
      }, 10)
    }, 45)
  })
  
  it("stops sending keep-alive requests when terminated", (done) => {
    monitor.monitor(new Request({}, 0)).then(() => {
      expect(lastRequest.isKeepAlive).toBeUndefined()
      
      done()
    })
    keepAlive.terminate()
  })
  
  it("does not send keep-alive requests while there are client requests",
      (done) => {
    monitor.monitor(new Request({}, 0)).then(() => {
      expect(lastRequest.isKeepAlive).toBeUndefined()
    })
    
    monitor.monitor(new Request({}, 10)).then(() => {
      expect(lastRequest.isKeepAlive).toBeUndefined()
    })
    
    monitor.monitor(new Request({}, 25)).then(() => {
      expect(lastRequest.isKeepAlive).toBeTruthy()
      
      done()
    })
  })
  
  it("stops sending keep-alive requests if new client request appears",
      (done) => {
    monitor.monitor(new Request({}, 5)).then(() => {
      expect(lastRequest.isKeepAlive).toBeTruthy()
      
      monitor.monitor(new Request({}, 5)).then(() => {
        expect(lastRequest.isKeepAlive).toBeUndefined()
      })
      
      monitor.monitor(new Request({}, 15)).then(() => {
        expect(lastRequest.isKeepAlive).toBeTruthy()
        
        done()
      })
    })
  })
  
  it("stops sending keep-alive requests if client request fails", (done) => {
    monitor.monitor(new Request(new Error(), 2)).catch(() => {})
    
    setTimeout(() => {
      expect(lastRequest.isKeepAlive).toBeUndefined()
      
      done()
    }, 30)
  })
  
  class ObjectStore {
    constructor(currentMonitor) {
      this.currentMonitor = currentMonitor
    }
    
    get(primaryKey) {
      let request = new Request({
        id: primaryKey,
        isKeepAlive: true
      }, 10)
      request.isKeepAlive = true
      request.currentMonitor = this.currentMonitor
      return request
    }
  }

  class Request {
    constructor(result, resolveIn) {
      this.result = result instanceof Error ? null : result
      this.error = result instanceof Error ? result : null
      this.created = Date.now()
      
      if (typeof resolveIn === "number") {
        setTimeout(() => {
          if (result instanceof Error) {
            (this.onerror || (() => {}))({})
          } else {
            (this.onsuccess || (() => {}))({})
          }
        }, resolveIn)
      }
    }
  }
  
})
