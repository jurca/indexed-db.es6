define([], function() {
  "use strict";
  var STATE = Object.freeze({
    PENDING: Object.freeze({}),
    RESOLVED: Object.freeze({}),
    REJECTED: Object.freeze({})
  });
  var FIELDS = Object.freeze({
    state: Symbol("state"),
    value: Symbol("value"),
    fulfillListeners: Symbol("fulfillListeners"),
    errorListeners: Symbol("errorListeners")
  });
  var PromiseSync = (function() {
    function PromiseSync(callback) {
      var $__0 = this;
      this[FIELDS.state] = STATE.PENDING;
      this[FIELDS.value] = undefined;
      this[FIELDS.fulfillListeners] = [];
      this[FIELDS.errorListeners] = [(function() {
        if ($__0[FIELDS.errorListeners] === 1) {
          console.error("Uncaught (in sync promise)", $__0[FIELDS.value]);
        }
      })];
      try {
        callback((function(value) {
          return resolve($__0, STATE.RESOLVED, value);
        }), (function(error) {
          return resolve($__0, STATE.REJECTED, error);
        }));
      } catch (error) {
        resolve(this, STATE.REJECTED, error);
      }
    }
    return ($traceurRuntime.createClass)(PromiseSync, {
      then: function(onFulfill) {
        var onError = arguments[1];
        var $__0 = this;
        var thisPromise = this;
        return new PromiseSync((function(resolve, reject) {
          switch ($__0[FIELDS.state]) {
            case STATE.PENDING:
              $__0[FIELDS.fulfillListeners].push((function() {
                return handleResolution(onFulfill);
              }));
              $__0[FIELDS.errorListeners].push((function() {
                return handleResolution(onError);
              }));
              break;
            case STATE.RESOLVED:
              handleResolution(onFulfill);
              break;
            case STATE.REJECTED:
              handleResolution(onError);
              break;
          }
          function handleResolution(callback) {
            if (!(callback instanceof Function)) {
              if (thisPromise[FIELDS.state] === STATE.RESOLVED) {
                resolve(thisPromise[FIELDS.value]);
              } else {
                reject(thisPromise[FIELDS.value]);
              }
            }
            try {
              var newValue = callback(thisPromise[FIELDS.value]);
              if (newValue instanceof PromiseSync) {
                newValue.then((function(resultingValue) {
                  return resolve(resultingValue);
                }), (function(error) {
                  return reject(error);
                }));
              } else {
                resolve(newValue);
              }
            } catch (error) {
              reject(error);
            }
          }
        }));
      },
      catch: function(onError) {
        return this.then(undefined, onError);
      },
      toPromise: function() {
        var $__0 = this;
        return new Promise((function(resolve, reject) {
          $__0.then(resolve, reject);
        }));
      }
    }, {
      resolve: function(value) {
        if (value instanceof PromiseSync) {
          return value;
        }
        if (value instanceof Promise) {
          return new PromiseSync((function(resolve, reject) {
            value.then(resolve, reject);
          }));
        }
        if (value instanceof IDBRequest) {
          return new PromiseSync((function(resolve, reject) {
            value.onsuccess = (function() {
              return resolve(value.result);
            });
            value.onerror = (function() {
              return reject(value.error);
            });
          }));
        }
        return new PromiseSync((function(resolve) {
          resolve(value);
        }));
      },
      reject: function(error) {
        return new PromiseSync((function() {
          throw error;
        }));
      },
      all: function(promises) {
        return new PromiseSync((function(resolve, reject) {
          var state = [];
          var $__5 = true;
          var $__6 = false;
          var $__7 = undefined;
          try {
            var $__9 = function() {
              var promise = $__3.value;
              {
                var promiseState = {
                  resolved: false,
                  result: undefined
                };
                state.push(promiseState);
                promise.then((function(result) {
                  promiseState.result = result;
                  promiseState.resolved = true;
                  checkState();
                }));
                promise.catch((function(error) {
                  reject(error);
                }));
              }
            };
            for (var $__3 = void 0,
                $__2 = (promises)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
              $__9();
            }
          } catch ($__8) {
            $__6 = true;
            $__7 = $__8;
          } finally {
            try {
              if (!$__5 && $__2.return != null) {
                $__2.return();
              }
            } finally {
              if ($__6) {
                throw $__7;
              }
            }
          }
          function checkState() {
            if (state.every((function(promiseState) {
              return promiseState.resolved;
            }))) {
              resolve(state.map((function(promiseState) {
                return promiseState.result;
              })));
            }
          }
        }));
      },
      race: function(promises) {
        return new PromiseSync((function(resolve, reject) {
          var $__5 = true;
          var $__6 = false;
          var $__7 = undefined;
          try {
            for (var $__3 = void 0,
                $__2 = (promises)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
              var promise = $__3.value;
              {
                promise.then(resolve, reject);
              }
            }
          } catch ($__8) {
            $__6 = true;
            $__7 = $__8;
          } finally {
            try {
              if (!$__5 && $__2.return != null) {
                $__2.return();
              }
            } finally {
              if ($__6) {
                throw $__7;
              }
            }
          }
        }));
      }
    });
  }());
  var $__default = PromiseSync;
  function resolve(instance, newState, value) {
    if (instance[FIELDS.state] !== STATE.PENDING) {
      return ;
    }
    instance[FIELDS.state] = newState;
    instance[FIELDS.value] = value;
    var listeners;
    if (newState === STATE.RESOLVED) {
      listeners = instance[FIELDS.fulfillListeners];
    } else {
      listeners = instance[FIELDS.errorListeners];
    }
    var $__5 = true;
    var $__6 = false;
    var $__7 = undefined;
    try {
      for (var $__3 = void 0,
          $__2 = (listeners)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
        var listener = $__3.value;
        {
          listener();
        }
      }
    } catch ($__8) {
      $__6 = true;
      $__7 = $__8;
    } finally {
      try {
        if (!$__5 && $__2.return != null) {
          $__2.return();
        }
      } finally {
        if ($__6) {
          throw $__7;
        }
      }
    }
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/PromiseSync.js
