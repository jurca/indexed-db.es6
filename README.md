# indexed-db.es6
Flexible wrapper of IndexedDB APIs utilizing the features provided by ES6.

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
