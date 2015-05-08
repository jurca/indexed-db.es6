
/**
 * Validates the provided number whether it is a valid database version number.
 *
 * @param {number} version The version number to validate.
 * @return {boolean} {@code true} if the version number is valid.
 */
export function isVersionValid(version) {
  return (parseInt(`${version}`, 10) === version) &&
      (version >= 1)
}

/**
 * Tests the provided object store descriptors for name duplicities.
 *
 * @type {(ObjectStoreSchema[]|IndexSchema[])} schemas The definitions of
 *       object stores to check for name duplicities.
 * @return {string[]} The names of schemas that have multiple occurrences in
 *         the provided array.
 */
export function getDuplicitNames(schemas) {
  let nameOccurrences = new Map()
  schemas.forEach((schema) => {
    let count = (nameOccurrences.get(schema.name) || 0) + 1
    nameOccurrences.set(schema.name, count)
  })

  let duplicitNames = []
  schemas.forEach((count, schemaName) => {
    if (count > 1) {
      duplicitNames.push(schemaName)
    }
  })

  return duplicitNames
}
