![build status](https://travis-ci.org/jurca/indexed-db.es6.svg?branch=master)

# indexed-db.es6

The indexed-db.es6 is ES6-style wrapper of the native
[IndexedDB](http://www.w3.org/TR/IndexedDB/) HTML5
[document-oriented database](http://en.wikipedia.org/wiki/Document-oriented_database).

The indexed-db.es6 provides the following improvements and modifications over
the native IndexedDB:

- declarative schema with data-migration support
- [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)-oriented
  API
- renaming of some declaratively-named methods (for example transaction) to
  imperative names (startTransaction).
- API does not expose the native schema-manipulation methods
- read-only transactions expose only read-only API
- support for advanced record filtering
- advanced query API 
- record lists with lazy-fetching of "pages" of records
- very-well documented code :)
- API split into ES6 modules in the source code, available as ES6 modules or
  AMD modules
- practically all native IndexedDB features are available through the API

## Quickstart

You can install the indexed-db.es6 library into your project using bower:

```
bower install --save indexed-db.es6
```

You will need the Traceur compiler (at least the runtime) to use
indexed-db.es6. Since there is no official bower package for this, you can
install traceur into your project by running either the following command:

```
npm install --production
```

or the following command:

```
npm install traceur
```

Aditionally, if you want to use indexed-db.es6 with
[AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) modules instead of ES6, you
will need an AMD module loader, for example requirejs:

```
bower install --save requirejs
```

### Connecting to a database

To use indexed-db.es6 to create and connect to a database, use the `DBFactory`
class:

```
import DBFactory from "bower_components/indexed-db.es6/DBFactory"

DBFactory.open("my database", {
  version: 1,
  objectStores: [{
    name: "fooBar",
    keyPath: null,
    autoIncrement: true,
    indexes: [{
      name: "some index",
      keyPath: "id",
      unique: false,
      multiEntry: true
    }]
  }]
}).then((database) => {
  // do some stuff

  database.close()
})
```

When using plain objects to describe the schema, many fields may be left out if
the default value is meant to be used (see the schema classes).

Alternatively, if you preffer, you may use the following syntax to specify your
database schema:

```
import DBFactory from "bower_components/indexed-db.es6/DBFactory"
import DatabaseSchema from
    "bower_components/indexed-db.es6/schema/DatabaseSchema"
import ObjectStoreSchema from
    "bower_components/indexed-db.es6/schema/ObjectStoreSchema"
import IndexSchema from "bower_components/indexed-db.es6/schema/IndexSchema"

DBFactory.open("my database",
  new DatabaseSchema(1,
    new ObjectStoreSchema("fooBar", null, true,
      new IndexSchema("some index", "id", false, true)
    )
  )
}).then((database) => {
  // do some stuff

  database.close()
})
```

### Running transactions

All operations performed on an IndexedDB database must always be performed in a
transaction.

To start a transaction, you need to specify whether the transaction should be
a read-only or read-write transaction, and the names of the object stores you
want to access in the transaction:

```
database.runReadOnlyTransaction(["foo", "bar], (foo, bar) => {
  // do some stuff
}).then((result) => {
  // Do something with the result of the promise returned from the transaction
  // callback. This callback will be called after the transaction is completed.
}).catch((error) => {
  // Something went wrong. Check the error for details.
})

// read-write transaction:
database.runTransaction(["foo", "bar"], (foo, bar) => {
  // do some stuff
}).then((result) => {
  // Do something with the result of the promise returned from the transaction
  // callback. This callback will be called after the transaction is completed.
}).catch((error) => {
  // Something went wrong. Check the error for details.
})
```

Note that while a read-only transaction has shared locks on the object stores,
a read-write transaction has an exclusive lock on all object stores available
to it, meaning that any other transaction on any of the object stores in the
read-write transaction will be delayed until the read-write transaction is
either completed or aborted. This will not prevent yout to start another
transaction or perform operations, but executing those operations on the
database will be delayed.

It you need a more low-level access to the transaction, use the
`startTransaction` and `startReadOnlyTransaction` methods instead. There is
also the `getObjectStore` method for creating a new read-only transaction with
access to only a single object store.

### Performing read operations

To fetch records from object stores (or through indexes), you can either fetch
single records:

```
myObjectStore.get(primaryKey).then((record) => {
  // do something
})
```

...or iterate through the records:

```
import CursorDirection from
    "bower_components/indexed-db.es6/object-store/CursorDirection"
// or you can import the NEXT and PREVIOUS constants like this:
// import {NEXT, PREVIOUS} from
//     "bower_components/indexed-db.es6/object-store/CursorDirection"

// connect to the database, start a transaction

myObjectStore.forEach(someFilter, CursorDirection.NEXT, (record) => {
  // do something with the record
}).then((recordCount) => {
  // all records matching the filter have been traversed 
})

// you may also use the "NEXT" and "PREVIOUS" strings (letter case does not
// matter):

myObjectStore.forEach(someFilter, "previous", (record) => {
  // do something with the record
}).then((recordCount) => {
  // all records matching the filter has been traversed
})
```

...or fetch all records to an array:

```
myObjectStore.getAll(optionalFilter, optionalDirection).then((allRecords) => {
  // do something
})
```

...or just count records matching a filter:

```
myObjectStore.count(optionalFilter).then((recordCount) => {
  // do something with the record count
})
```

...or you can use the record list (extension of the native JavaScript `Array`)
which allows processing the records in "pages", allowing you to fetch the next
page of records lazily even if the original transaction has already been
terminated:

```
import CursorDirection from
    "bower_components/indexed-db.es6/object-store/CursorDirection"

// connect to the database, start a transaction

myObjectStore.list(myFilter, CursorDirection.PREVIOUS, myPageSize).
    then((list) => {
  // do something with the first page
  
  // after some time:
  if (list.hasNextPage) {
    list.fetchNextPage().then((nextPage) => {
      // do something with the next page of records
    })
  }
})
```

Alternatively, you may open a cursor (or a key cursor) and iterate the object
store or index, but this if fairly low-level API, close to the native Indexed
DB API.

### Creating, updating and deleting records

All operations listed here are available only within a read-write transaction.

New records can be created in an object store using the `add` method:

```
myObjectStore.add("this is a record").then((primaryKey) => {
  // record will be added when the transaction completes
})

myObjectStore.add({
  created: new Date()
  note: "this is also a record"
}).then((primaryKey) => {
  // record will be added when the transaction completes
})
```

Existing records may be updated using the `put` method:

```
myObjectStore.put({
  id: 123,
  updated: new Date(),
  note: "this record will be updated"
}).then((primaryKey) => {
  // record will be updated when the transaction completes
})

// for object stores using out-of-line keys (stored outside of records),
// specify the key as the second argument:

myObjectStore.put({
  updated: new Date(),
  note: "this record will be updated"
}, 123).then((primaryKey) => {
  // record will be updated when the transaction completes
})

```

Records may be deleted using the `delete` method:

```
myObjectStore.delete(primaryKeyOrFilter).then(() => {
  // the record(s) will be deleted when the transaction completes
})
```

Finally, you may delete all records in an object store using the `clear`
method:

```
myObjectStore.clear().then(() => {
  // the object store will be empty when the transaction completes
})
```

Alternatively, you may modify and / or delete records through a cursor opened
within a read-write transaction, but this is fairly low-level API, close to the
native Indexed DB API.

## API Documentation

The source code is well documented using [JSDoc](http://usejsdoc.org/) docblock
comments. Go ahead and
[take a look](https://github.com/jurca/indexed-db.es6/tree/master/es6)!

## Browser support

The following browsers are supported (all tests are passing):

- Google Chrome
- Chromium
- Firefox

The following browsers are theoretically compatible (each seems to use engine
of one of the supported browsers), but not tested:

- Opera
- Seznam.cz Browser
- Opera Mobile
- Android Browser (4.4+)
- Chrome for Android
- Firefox for Android

The following browsers are not supported at the moment:

- Internet Explorer: Does not support compound keys and key paths and no new
  versions are expected to be released
- Safari:
  - Does not allow records in separate object stores to have the same
    primary key, the next version should fix this
  - Requires Apple hardware to run legally
- iOS Safari: same issues as Safari

You can still use these browsers with `indexed-db.es6`, or any browser without
any native IndexedDB support that supports
[WebSQL](http://www.w3.org/TR/webdatabase/) using the
[IndexedDBShim](https://github.com/axemclion/IndexedDBShim) polyfill.

## The current state of this project

There are no current plans for additional features (unless a good case for
adding them is made), but the project accepts bug fixes if new bugs are
discovered.

## Contributing

Time is precious, so, if you would like to contribute (bug fixing, test writing
or feature addition), follow these steps:

- fork
- implement (follow the code style)
- pull request
- wait for approval/rejection of the pull request

Filing a bug issue *might* get me to fix the bug, but filing a feature request
will not as I don't have the time to work on this project full-time. Thank you
for understanding.

## Alternatives

The indexed-db.es6 is a relatively complex library that allows you to use the
full power of IndexedDB through both the low- and high-level APIs. That being
said, you may not need such a tool and may be looking for a simpler solution:

- [PouchDB](http://pouchdb.com/) if you require only a single object store per
  database.
- [DB.js](https://github.com/aaronpowell/db.js) if you do not need transaction
  support, or don't need certain low-level or high-level features of
  indexed-db.es6, or you are not concerned about the database being opened from
  several browser tabs simultaneously.
- [IDB Wrapper](https://github.com/jensarps/IDBWrapper) if you preffer
  callbacks to Promises.
- [jQuery IndexedDB](http://nparashuram.com/jquery-indexeddb/) if you think you
  need to use jQuery for everything (which is a bad idea, in my opinion, but
  that's up to you to decide).
- [YDN DB](https://github.com/yathit/ydn-db) if you don't need any support for
  versioning your database.
- [IDBWrapper](https://github.com/jensarps/IDBWrapper) if you don't need
  transacions on multiple object stores and prefer callbacks to promises, and
  don't need any high-level API. 
