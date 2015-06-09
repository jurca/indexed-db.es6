define(["./KeyRange", "./CursorDirection"], function($__0,$__2) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var KeyRange = $__0.default;
  var CursorDirection = $__2.default;
  var FIELDS = Object.freeze({
    storageFactory: Symbol("storageFactory"),
    nextKey: Symbol("nextKey"),
    firstPrimaryKey: Symbol("firstPrimaryKey"),
    cursorDirection: Symbol("cursorDirection"),
    unique: Symbol("unique"),
    filter: Symbol("filter"),
    pageSize: Symbol("pageSize"),
    hasNextPage: Symbol("hasNextPage")
  });
  var RecordList = function($__super) {
    function RecordList(items, storageFactory, nextKey, firstPrimaryKey, cursorDirection, unique, filter, pageSize, hasNextPage) {
      $traceurRuntime.superConstructor(RecordList).call(this);
      if (items.length > pageSize) {
        throw new Error("The record list cannot be longer than the page size");
      }
      this[FIELDS.storageFactory] = storageFactory;
      this[FIELDS.nextKey] = nextKey;
      this[FIELDS.firstPrimaryKey] = firstPrimaryKey;
      this[FIELDS.cursorDirection] = cursorDirection;
      this[FIELDS.unique] = unique;
      this[FIELDS.filter] = filter;
      this[FIELDS.pageSize] = pageSize;
      this[FIELDS.hasNextPage] = hasNextPage;
      this.push.apply(this, items);
    }
    return ($traceurRuntime.createClass)(RecordList, {
      get hasNextPage() {
        return this[FIELDS.hasNextPage];
      },
      fetchNextPage: function() {
        if (!this.hasNextPage) {
          throw new Error("There are no more pages of records to fetch");
        }
        var storageFactory = this[FIELDS.storageFactory];
        var cursorDirection = this[FIELDS.cursorDirection];
        var unique = this[FIELDS.unique];
        var keyRange;
        if (cursorDirection === CursorDirection.NEXT) {
          keyRange = KeyRange.lowerBound(this[FIELDS.nextKey]);
        } else {
          keyRange = KeyRange.upperBound(this[FIELDS.nextKey]);
        }
        var pageSize = this[FIELDS.pageSize];
        return fetchNextPage(storageFactory, keyRange, cursorDirection, unique, this[FIELDS.firstPrimaryKey], this[FIELDS.filter], pageSize);
      }
    }, {}, $__super);
  }(Array);
  var $__default = RecordList;
  function fetchNextPage(storageFactory, keyRange, cursorDirection, unique, firstPrimaryKey, filter, pageSize) {
    var storage = storageFactory();
    var nextItems = [];
    return new Promise(function(resolve, reject) {
      var cursorFactory = storage.createCursorFactory(keyRange, cursorDirection, unique);
      cursorFactory(function(cursor) {
        if (!unique) {
          var shouldSkip = ((cursorDirection === CursorDirection.NEXT) && (indexedDB.cmp(firstPrimaryKey, cursor.primaryKey) > 0)) || ((cursorDirection === CursorDirection.PREVIOUS) && (indexedDB.cmp(firstPrimaryKey, cursor.primaryKey) < 0));
          if (shouldSkip) {
            cursor.continue();
            return;
          }
        }
        if (!filter || filter(cursor.record, cursor.primaryKey, cursor.key)) {
          if (nextItems.length === pageSize) {
            finalize(true, cursor.key, cursor.primaryKey);
            return;
          } else {
            nextItems.push(cursor.record);
          }
        }
        cursor.continue();
      }).then(function() {
        return finalize(false, null, null);
      }).catch(function(error) {
        return reject(error);
      });
      function finalize(hasNextPage, nextKey, nextPrimaryKey) {
        resolve(new RecordList(nextItems, storageFactory, nextKey, nextPrimaryKey, cursorDirection, unique, filter, pageSize, hasNextPage));
      }
    });
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});
//# sourceURL=es6/object-store/RecordList.js
