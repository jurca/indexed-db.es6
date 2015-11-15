
import KeyRange from "../../es2015/object-store/KeyRange"
import {range} from "../../es2015/object-store/KeyRange"

describe("KeyRange", () => {

  describe("from", () => {

    it("should create an upper-bound range", () => {
      let range = KeyRange.from(null, 1)
      expect(range).toEqual(KeyRange.upperBound(1))

      range = KeyRange.from(null, 2, true)
      expect(range).toEqual(KeyRange.upperBound(2, true))
    })

    it("should create a lower-bound range", () => {
      let range = KeyRange.from(3, null)
      expect(range).toEqual(KeyRange.lowerBound(3))

      range = KeyRange.from(true, 3, null)
      expect(range).toEqual(KeyRange.lowerBound(3, true))
    })

    it("should create a bound range", () => {
      let range = KeyRange.from(5, 6)
      expect(range).toEqual(KeyRange.bound(5, 6))

      range = KeyRange.from(true, 7, 8)
      expect(range).toEqual(KeyRange.bound(7, 8, true))

      range = KeyRange.from(9, 10, true)
      expect(range).toEqual(KeyRange.bound(9, 10, false, true))

      range = KeyRange.from(true, 11, 12, true)
      expect(range).toEqual(KeyRange.bound(11, 12, true, true))
    })

    it("should reject invalid range specification", () => {
      expect(() => range(true, false)).toThrow()
      expect(() => range(3, null, true)).toThrow()
      expect(() => range(3, null, false)).toThrow()
      expect(() => range(true, null, 1)).toThrow()
      expect(() => range(1, 2, 3)).toThrow()
    })

  })

})
