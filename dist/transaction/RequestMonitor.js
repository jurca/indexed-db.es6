define([], function() {
  "use strict";
  var FIELDS = Object.freeze({
    pendingRequests: Symbol("pendingRequests"),
    onNoPendingRequests: Symbol("onNoPendingRequests")
  });
  var RequestMonitor = (function() {
    function RequestMonitor(onNoPendingRequests) {
      this[FIELDS.pendingRequests] = new Set();
      this[FIELDS.onNoPendingRequests] = onNoPendingRequests;
      Object.freeze(this);
    }
    return ($traceurRuntime.createClass)(RequestMonitor, {monitor: function(request) {
        var $__0 = this;
        this[FIELDS.pendingRequests].add(request);
        var onRequestFinished = (function(wasSuccessful) {
          $__0[FIELDS.pendingRequests].delete(request);
          if (!$__0[FIELDS.pendingRequests].size) {
            $__0[FIELDS.onNoPendingRequests](request, wasSuccessful);
          }
        });
        return new Promise((function(resolve, reject) {
          request.onsuccess = (function() {
            resolve(request.result);
            onRequestFinished(true);
          });
          request.onerror = (function() {
            reject(request.error);
            onRequestFinished(false);
          });
        }));
      }}, {});
  }());
  var $__default = RequestMonitor;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/transaction/RequestMonitor.js
