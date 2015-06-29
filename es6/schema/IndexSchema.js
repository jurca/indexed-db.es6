
/**
 * Schema descriptor for object store indexes.
 */
export default class IndexSchema {
  /**
   * Initializes the object store index schema descriptor.
   *
   * @param {string} indexName The name of the index.
   * @param {(string|string[])} keyPath The field path or paths specified the
   *        fields that will be used for index keys.
   * @param {boolean} unique When {@code true}, the index will enfore that
   *        records have unique values set to the fields specified by the
   *        provided key paths.
   * @param {boolean} multiEntry When {@code true} and a key field (a field
   *        specified a key path) resolves to an {@linkcode Array}, the index
   *        will create an index entry for each element of the array.
   */
  constructor(indexName, keyPath, unique = false, multiEntry = false) {
    /**
     * The name of the index. The name must be unique among the indexes of the
     * object store.
     *
     * @type {string}
     */
    this.name = indexName

    /**
     * The paths to the fields that will be used as keys in this index. This
     * field is either a single field path or a an array of field paths. A
     * field path is a sequence of field names joined by dots ({@code "."}),
     * for example {@code "id"} or {@code "foo.bar.primaryKeyField"}.
     *
     * @type {(string|string[])}
     */
    this.keyPath = keyPath

    /**
     * When {@code true}, the index prevents creation and modification of
     * records that would result in two records indexed by this index having
     * the same value in any of the fields specified by this index's key paths.
     * Such an operation would result in failure an the modification would not
     * take place.
     *
     * When {@code false}, no such restriction is applied.
     *
     * @type {boolean}
     */
    this.unique = unique

    /**
     * Affects how the index handles the situation when evaluating a key path
     * yields an {@codelink Array}.
     *
     * When {@code true}, the index will create an index entry for every
     * element of the yielded array.
     *
     * When {@code false}, the index will create a single index entry with the
     * yielded array as a key.
     *
     * @type {boolean}
     */
    this.multiEntry = multiEntry

    Object.freeze(this)
  }
}
