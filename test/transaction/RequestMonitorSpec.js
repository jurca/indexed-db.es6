
import RequestMonitor from "../../dist/transaction/RequestMonitor"

describe("RequestMonitor", () => {
  
  let monitor
  let callbackExecuted
  let callbackTriggerCount
  let callbackRequest
  let callbackSuccess
  
  beforeEach(() => {
    callbackExecuted = false
    callbackTriggerCount = 0
    callbackRequest = undefined
    callbackSuccess = undefined
    
    monitor = new RequestMonitor((request, success) => {
      callbackExecuted = true
      callbackTriggerCount++
      callbackRequest = request
      callbackSuccess = success
    })
  })
  
  it("should trigger the callback synchronously", (done) => {
    let request = new Request(null)
    monitor.monitor(request)
    
    setTimeout(() => {
      expect(callbackExecuted).toBeFalsy()
      request.onsuccess({})
      expect(callbackExecuted).toBeTruthy()
      expect(callbackTriggerCount).toBe(1)
      expect(callbackRequest).toBe(request)
      expect(callbackSuccess).toBeTruthy()
      
      request = new Request(new Error())
      monitor.monitor(request).catch(() => {})
      request.onerror({})
      expect(callbackTriggerCount).toBe(2)
      expect(callbackRequest).toBe(request)
      expect(callbackSuccess).toBeFalsy()
      
      done()
    }, 10)
  })
  
  it("should trigger the callback when the last pending request completes",
      (done) => {
    monitor.monitor(new Request(null, 10)).then(() => {
      expect(callbackExecuted).toBeFalsy()
    })
    
    monitor.monitor(new Request(null, 15)).then(() => {
      expect(callbackExecuted).toBeTruthy()
      expect(callbackTriggerCount).toBe(1)
      
      done()
    })
    
    monitor.monitor(new Request(null, 11)).then(() => {
      expect(callbackExecuted).toBeFalsy()
    })
  })
  
  it("should return promise resolved to request result", (done) => {
    monitor.monitor(new Request("my result", 0)).then((result) => {
      expect(result).toBe("my result")
      
      done()
    })
  })
  
  it("should return promise rejected with the request error", (done) => {
    monitor.monitor(
      new Request(new Error("hello there!"), 0)
    ).catch((error) => {
      expect(error.message).toBe("hello there!")
      
      done()
    })
  })
  
  class Request {
    constructor(result, resolveIn) {
      this.result = result instanceof Error ? null : result
      this.error = result instanceof Error ? result : null
      
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
