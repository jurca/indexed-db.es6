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
        this[FIELDS.pendingRequests].add(request);
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
        function onRequestFinished(wasSuccessful) {
          this[FIELDS.pendingRequests].delete(request);
          if (!this[FIELDS.pendingRequests].size) {
            this[FIELDS.onNoPendingRequests](request, wasSuccessful);
          }
        }
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
