define([], function() {
  "use strict";
  var FIELDS = Object.freeze({
    requestMonitor: Symbol("requestMonitor"),
    keepAliveObjectStoreFactory: Symbol("keepAliveObjectStoreFactory"),
    commitDelay: Symbol("commitDelay"),
    lastClientRequest: Symbol("lastClientRequest"),
    lastKeepAliveRequest: Symbol("lastKeepAliveRequest"),
    terminated: Symbol("terminated")
  });
  var KeepAlive = (function() {
    function KeepAlive(keepAliveObjectStoreFactory, commitDelay) {
      var $__0 = this;
      this[FIELDS.keepAliveObjectStoreFactory] = keepAliveObjectStoreFactory;
      this[FIELDS.commitDelay] = commitDelay;
      this[FIELDS.lastClientRequest] = 0;
      this[FIELDS.lastKeepAliveRequest] = null;
      this[FIELDS.terminated] = false;
      this[FIELDS.requestMonitor] = new RequestMonitor((function(request, success) {
        if (terminated) {
          return ;
        }
        if (!success) {
          return ;
        }
        if (request !== $__0[FIELDS.lastKeepAliveRequest]) {
          $__0[FIELDS.lastClientRequest] = Date.now();
        }
        var sinceLastClientRequest = Date.now() - $__0[FIELDS.lastClientRequest];
        if (sinceLastClientRequest > $__0[FIELDS.commitDelay]) {
          return ;
        }
        var objectStore = keepAliveObjectStoreFactory();
        $__0[FIELDS.lastKeepAliveRequest] = objectStore.get(0);
        $__0[FIELDS.requestMonitor].monitor($__0[FIELDS.lastKeepAliveRequest]);
      }));
    }
    return ($traceurRuntime.createClass)(KeepAlive, {
      get requestMonitor() {
        return this[FIELDS.requestMonitor];
      },
      terminate: function() {
        this[FIELDS.terminated] = true;
      }
    }, {});
  }());
  var $__default = KeepAlive;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=src/transaction/KeepAlive.js
