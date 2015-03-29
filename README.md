# indexed-db.es6

The indexed-db.es6 is ES6-style wrapper of the native
[IndexedDB](http://www.w3.org/TR/IndexedDB/) HTML5
[document-oriented database](http://en.wikipedia.org/wiki/Document-oriented_database).

The indexed-db.es6 provides the following improvements and modifications over
the native IndexedDB:

- declarative schema
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
- API split into ES6 modules
- all native IndexedDB features are available through the API

## The current state of this project

While the implementation is feature-complete, tests are still being written to
make sure the API works reliably.

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

The IndexedDB.ES6 is a relatively thin wrapper that allows you to use the full
power of IndexedDB. That being said, you may not need such a tool and may be
looking for a simpler solution:

- [PouchDB](http://pouchdb.com/) if you require only a single object store per
  database.
- [DB.js](https://github.com/aaronpowell/db.js) if you do not need to lock
  multiple object stores for a transaction.
- [IDB Wrapper](https://github.com/jensarps/IDBWrapper) if you preffer
  callbacks to Promises.
- [jQuery IndexedDB](http://nparashuram.com/jquery-indexeddb/) if you think you
  need to use jQuery for everything (which is a bad idea, in my opinion, but
  that's up to you to decide).
- [YDN DB](https://github.com/yathit/ydn-db) if you don't need any support for
  versioning your database.
