/* typed-enum 0.1.1 2013-12-26T09:54:25.111Z
 * Author: hax <johnhax@gmail.com>
 * License: MIT
 */

void function (global, factory) {
	'use strict'
	if (typeof require === 'function' &&
		typeof exports === 'object' && exports !== null &&
		typeof module === 'object' && module !== null
	) {
		// CommonJS Module/1.1+
		factory(require, exports, module)
	} else if (typeof define === 'function' && (define.amd || define.cmd)) {
		// AMD (simplified CommonJS wrapping) or CMD
		define(factory)
	} else {
		if (!('MY_MODULES' in global)) global.MY_MODULES = {}
		var m = global.MY_MODULES['typed-enum'] = { exports: {} }
		factory(
			function (id) {
				return global.MY_MODULES[id].exports
			},
			m.exports, m
		)
	}
}(this, function (require, exports, module) {

'use strict'

// imports


// exports
Object.defineProperties(exports, {
	"default": { get: function () { return Enum } }
})
Object.defineProperty(module, "exports", {
	get: function () { return Enum }
})


;
// Begin Enum.js
function Enum() {

	if (arguments.length < 1) throw Error('Insufficent arguments')

	var instances = [], values = [], mappings = {}

	var MyEnum = function (name) {
		if (mappings.hasOwnProperty(name)) return mappings[name]
		else throw TypeError('invalid enum name: ' + name)
	}
	Object.defineProperties(MyEnum, {
		has: { value: function (name) { return mappings.hasOwnProperty(name) } },
	})
	var getValue = function () { return this.value }
	Object.defineProperties(MyEnum.prototype, {
		valueOf: { value: getValue },
		toJSON: { value: getValue }
	})

	function addValue(name, value) {
		if (mappings.hasOwnProperty(name)) throw Error('Duplicated enum name: ' + name)
		if (/^\s*$/.test(value)) throw Error('Empty enum value')
		var o, i = values.indexOf(value)
		if (i >= 0) o = instances[i]
		else {
			o = Object.seal(Object.create(MyEnum.prototype, {
				value: { value: value }
			}))
			values.push(value)
			instances.push(o)
		}
		mappings[name] = o
		var key = CONSTANT_CASE(name)
		MyEnum[key] = o
		return o
	}

	for (var i = 0, n = arguments.length; i < n; i++) {
		var arg = arguments[i]

		switch (typeof arg) {
			case 'string':
				addValue(arg, arg)
				break
			case 'object':
				if (arg !== null) {
					Object.keys(arg).forEach(function (key) { addValue(key, arg[key]) })
					break
				}
			default:
				throw TypeError()
		}
	}

	return Object.seal(MyEnum)
}

function CONSTANT_CASE(s) {
	return s.replace(/-|\s+/g, '_').toUpperCase()
}
// End Enum.js


})
