# code-red changelog

## 0.2.0

* Rewrite in JavaScript

## 0.1.7

* Include dependencies ([#56](https://github.com/Rich-Harris/code-red/pull/56))
* Add `sourceMapEncodeMappings` option ([#51](https://github.com/Rich-Harris/code-red/pull/51))

## 0.1.6

* Only use shorthand for non-computed properties ([#58](https://github.com/Rich-Harris/code-red/pull/58))

## 0.1.5

* Use `node.raw` where possible ([#55](https://github.com/Rich-Harris/code-red/pull/55))
* Support BigInt (([#54](https://github.com/Rich-Harris/code-red/issues/54)))

## 0.1.4

* Fix rendering of nullish coalescing operator alongside other logical operators ([#52](https://github.com/Rich-Harris/code-red/issues/52))

## 0.1.3

* Support nullish coalescing operator ([#42](https://github.com/Rich-Harris/code-red/issues/42))
* Support optional chaining ([#43](https://github.com/Rich-Harris/code-red/issues/43))

## 0.1.2

* Don't crash when using an arrow function as a statement ([#38](https://github.com/Rich-Harris/code-red/issues/38))

## 0.1.1

* Wrap arrow functions in parens as appropriate ([#31](https://github.com/Rich-Harris/code-red/issues/31))
* Throw on invalid expressions ([#31](https://github.com/Rich-Harris/code-red/issues/31))

## 0.1.0

* Throw on unhandled sigils ([#30](https://github.com/Rich-Harris/code-red/pull/30))

## 0.0.32

* Prevent syntax errors when combining comments ([#28](https://github.com/Rich-Harris/code-red/issues/28))

## 0.0.31

* Expose wrapped versions of Acorn methods to facilitate comment preservation ([#26](https://github.com/Rich-Harris/code-red/issues/26))

## 0.0.30

* Wrap `await` argument in parens if necessary ([#24](https://github.com/Rich-Harris/code-red/issues/24))

## 0.0.29

* Handle sigils in comments ([#21](https://github.com/Rich-Harris/code-red/issues/21))

## 0.0.28

* Add `toString` and `toUrl` methods on sourcemap objects ([#22](https://github.com/Rich-Harris/code-red/pull/22))

## 0.0.27

* Handle parenthesized expressions

## 0.0.26

* Always replace comment values ([#20](https://github.com/Rich-Harris/code-red/pull/20))

## 0.0.25

* Fix async/generator functions in object methods ([#18](https://github.com/Rich-Harris/code-red/issues/18))

## 0.0.24

* Determine shorthand eligibility after stringification ([#17](https://github.com/Rich-Harris/code-red/pull/17))

## 0.0.23

* Unescape sigils in literals ([#16](https://github.com/Rich-Harris/code-red/pull/16))

## 0.0.22

* Prevent erroneous object shorthand when key is an identifier ([#14](https://github.com/Rich-Harris/code-red/issues/14))

## 0.0.21

* Deconflict #-identifiers in function names ([#10](https://github.com/Rich-Harris/code-red/issues/10))
* Fix object expression with string literal key matching value ([#9](https://github.com/Rich-Harris/code-red/pull/9))

## 0.0.20

* Update deps

## 0.0.19

* Attach comments

## 0.0.18

* Handle mixed named/default imports ([#3](https://github.com/Rich-Harris/code-red/issues/3))
* Update dependencies ([#4](https://github.com/Rich-Harris/code-red/issues/4))

## 0.0.17

* Fixes and additions

## 0.0.16

* Improve some aspects of generated code

## 0.0.15

* Flatten patterns

## 0.0.13-14

* Sourcemaps

## 0.0.12

* Flatten object properties

## 0.0.11

* Handle deconfliction edge case

## 0.0.10

* Tweak some TypeScript stuff

## 0.0.9

* Adopt estree types
* Add a `p` function for creating properties

## 0.0.8

* Allow strings to be treated as identifiers

## 0.0.7

* Various

## 0.0.6

* Flatten arguments and parameters

## 0.0.5

* Omit missing statements
* Flatten arrays of statements

## 0.0.4

* Use fork of astring

## 0.0.3

* Allow return outside function
* Print code on syntax error

## 0.0.2

* Support `@`-prefixed names (replaceable globals)
* Support `#`-prefixed names (automatically deconflicted)

## 0.0.1

* First experimental release
