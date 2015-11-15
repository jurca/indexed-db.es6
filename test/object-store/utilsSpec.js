
import KeyRange from "../../es2015/object-store/KeyRange"
import {
  keyRangeToFieldRangeObject,
  compileFieldRangeFilter,
  normalizeFilter,
  compileOrderingFieldPaths
} from "../../es2015/object-store/utils"

describe("utils", () => {
  
  describe("keyRangeToFieldRangeObject", () => {
    
    it("should translate compount key range to range object", () => {
      let rangeObject = keyRangeToFieldRangeObject(
        KeyRange.only(15),
        "primaryKeyField"
      )
      
      expect(Object.keys(rangeObject)).toEqual(["primaryKeyField"])
      expect(rangeObject.primaryKeyField instanceof IDBKeyRange).toBeTruthy()
      expect(rangeObject.primaryKeyField.upper).toBe(15)
      expect(rangeObject.primaryKeyField.lower).toBe(15)
      expect(rangeObject.primaryKeyField.upperOpen).toBeFalsy()
      expect(rangeObject.primaryKeyField.lowerOpen).toBeFalsy()
    })
    
    it("should handle deep key path", () => {
      let rangeObject = keyRangeToFieldRangeObject(
        KeyRange.only("fooBar"),
        "some.field"
      )
      
      expect(Object.keys(rangeObject)).toEqual(["some"])
      expect(Object.keys(rangeObject.some)).toEqual(["field"])
      expect(rangeObject.some.field instanceof IDBKeyRange).toBeTruthy()
      expect(rangeObject.some.field.upper).toBe("fooBar")
      
      rangeObject = keyRangeToFieldRangeObject(
        KeyRange.only("fooBar"),
        "some.deep.deeper.field"
      )
      
      expect(Object.keys(rangeObject)).toEqual(["some"])
      expect(Object.keys(rangeObject.some)).toEqual(["deep"])
      expect(Object.keys(rangeObject.some.deep)).toEqual(["deeper"])
      expect(rangeObject.some.deep.deeper.field instanceof IDBKeyRange).
          toBeTruthy()
    })
    
    it("should handle compound keys", () => {
      let rangeObject = keyRangeToFieldRangeObject(
        KeyRange.only([11, "foobar"]),
        [
          "id",
          "some.field"
        ]
      )
      
      expect(Object.keys(rangeObject)).toEqual(["id", "some"])
      expect(Object.keys(rangeObject.some)).toEqual(["field"])
      expect(rangeObject.id instanceof IDBKeyRange).toBeTruthy()
      expect(rangeObject.some.field instanceof IDBKeyRange).toBeTruthy()
      expect(rangeObject.id.upper).toBe(11)
      expect(rangeObject.some.field.upper).toBe("foobar")
    })
    
  })
  
  describe("compileFieldRangeFilter", () => {
    
    it("should compile empty object", () => {
      let filter = compileFieldRangeFilter({})
      
      expect(filter instanceof Function).toBeTruthy()
      expect(filter({x: "anything"})).toBeTruthy()
    })
    
    it("should compile shallow field map", () => {
      let filter = compileFieldRangeFilter({
        number: 1,
        string: "foobar",
        date: new Date(10101),
        array: ["bar", 1, "foo"],
        lowerOpen: KeyRange.lowerBound(15, true),
        upperOpen: KeyRange.upperBound(16, true),
        bound: KeyRange.bound(new Date(999), new Date(1001)),
        only: KeyRange.only([15, new Date(500)])
      })
      
      expect(filter instanceof Function).toBeTruthy()
      
      let baseObject = {
        number: 1,
        string: "foobar",
        date: new Date(10101),
        array: ["bar", 1, "foo"],
        lowerOpen: 16,
        upperOpen: 15,
        bound: new Date(1000),
        only: [15, new Date(500)]
      }
      expect(filter(baseObject)).toBeTruthy()
      expect(filter({})).toBeFalsy()
      expect(filter(override(baseObject, {}))).toBeTruthy()
      
      expect(filter(override(baseObject, {
        number: 2
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        string: "something else"
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        date: new Date(10100)
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        array: ["bar", 11, "foo"]
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        lowerOpen: 15
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        upperOpen: 16
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        bound: new Date(998)
      }))).toBeFalsy()
      expect(filter(override(baseObject, {
        only: [15, new Date(501)]
      }))).toBeFalsy()
    })
    
    it("should compile deep field map", () => {
      let filter = compileFieldRangeFilter({
        number: 1,
        deep: {
          field: "foobar",
          deeper: {
            realNumber: 1.2
          }
        }
      })
      
      expect(filter instanceof Function).toBeTruthy()
      expect(filter({})).toBeFalsy()
      expect(filter({
        number: 1
      })).toBeFalsy()
      expect(filter({
        number: 1,
        deep: {
          field: "foobar"
        }
      })).toBeFalsy()
      expect(filter({
        number: 1,
        deep: {
          field: "foobar",
          deeper: {
            realNumber: 1.2
          }
        }
      })).toBeTruthy()
    })
    
    function override(source, overrides) {
      return Object.assign({}, source, overrides)
    }
    
  })
  
  describe("normalizeFilter", () => {
    
    it("should convert undefined and null to undefined", () => {
      expect(normalizeFilter(null)).toBeUndefined()
      expect(normalizeFilter(undefined)).toBeUndefined()
    })
    
    it("should convert simple keys to key ranges", () => {
      assertOnlyItemRange(normalizeFilter(1), 1)
      assertOnlyItemRange(normalizeFilter("foo"), "foo")
      assertOnlyItemRange(normalizeFilter(new Date(1001)), new Date(1001))
      assertOnlyItemRange(normalizeFilter([1, "a"]), [1, "a"])
      
      function assertOnlyItemRange(range, value) {
        expect(range instanceof IDBKeyRange).toBeTruthy()
        expect(range.lower).toEqual(value)
        expect(range.upper).toEqual(value)
        expect(range.lowerOpen).toBeFalsy()
        expect(range.upperOpen).toBeFalsy()
      }
    })
    
    it("should leave IDBKeyRange instance unchanged", () => {
      let range = KeyRange.only([1, 2])
      expect(normalizeFilter(range)).toBe(range)
    })
    
    it("should leave predicate function unchanged", () => {
      let predicate = () => true
      expect(normalizeFilter(predicate)).toBe(predicate)
    })
    
    it("should compile field map", () => {
      let filter = normalizeFilter({
        num: 4,
        deep: {
          field: "foobar"
        }
      })
      
      expect(filter({
        num: 4,
        deep: {
          field: "foobar"
        }
      })).toBeTruthy()
      expect(filter({
        num: 4
      })).toBeFalsy()
    })
    
  })

  describe("compileOrderingFieldPaths", () => {
    
    let records
    
    beforeEach(() => {
      records = [
        {
          id: 1,
          name: "Adam",
          category: 1,
          bio: {
            age: 37,
            birth: {
              day: 1,
              month: 12,
              year: 1992
            }
          }
        },
        {
          id: 2,
          name: "Joanna",
          category: 2,
          bio: {
            age: 38,
            birth: {
              day: 4,
              month: 6,
              year: 1972
            }
          }
        },
        {
          id: 3,
          name: "Phteven", // get it?
          category: 2,
          bio: {
            age: 40,
            birth: {
              day: 18,
              month: 3,
              year: 2002
            }
          }
        },
        {
          id: 4,
          name: "Lucy",
          category: 4,
          bio: {
            age: 26,
            birth: {
              day: 9,
              month: 7,
              year: 1982
            }
          }
        }
      ]
    })
    
    it("should handle simple sorting", () => {
      expectSortResults("id", [1, 2, 3, 4])
      expectSortResults("name", [1, 2, 4, 3])
      expectSortResults("!id", [4, 3, 2, 1])
    })
    
    it("should handle sorting by field paths", () => {
      expectSortResults("bio.age", [4, 1, 2, 3])
      expectSortResults("!bio.birth.month", [1, 4, 2, 3])
    })
    
    it("should handle sorting by multiple fields", () => {
      expectSortResults(["!category", "bio.age", "!name"], [4, 2, 3, 1])
    })
    
    function expectSortResults(sortBy, expected) {
      let comparator = compileOrderingFieldPaths(sortBy)
      records.sort(comparator)
      expect(recordsToIds()).toEqual(expected)
    }
    
    function recordsToIds() {
      return records.map(record => record.id)
    }
    
  })
  
})
