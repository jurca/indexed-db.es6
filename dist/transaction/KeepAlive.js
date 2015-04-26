define(["./RequestMonitor"], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var RequestMonitor = $__0.default;
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
      var $__2 = this;
      this[FIELDS.keepAliveObjectStoreFactory] = keepAliveObjectStoreFactory;
      this[FIELDS.commitDelay] = commitDelay;
      this[FIELDS.lastClientRequest] = 0;
      this[FIELDS.lastKeepAliveRequest] = null;
      this[FIELDS.terminated] = false;
      this[FIELDS.requestMonitor] = new RequestMonitor((function(request, success) {
        if ($__2[FIELDS.terminated]) {
          return ;
        }
        if (!success) {
          return ;
        }
        if (request !== $__2[FIELDS.lastKeepAliveRequest]) {
          $__2[FIELDS.lastClientRequest] = Date.now();
        }
        var sinceLastClientRequest = Date.now() - $__2[FIELDS.lastClientRequest];
        if (sinceLastClientRequest > $__2[FIELDS.commitDelay]) {
          return ;
        }
        var objectStore = keepAliveObjectStoreFactory();
        $__2[FIELDS.lastKeepAliveRequest] = objectStore.get(0);
        $__2[FIELDS.requestMonitor].monitor($__2[FIELDS.lastKeepAliveRequest]);
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
