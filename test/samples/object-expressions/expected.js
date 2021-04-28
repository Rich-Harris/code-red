obj = { foo, bar, baz: qux };
obj = { "1": "1" };
obj = { true: true };
obj = { foo };
obj = { [foo]: foo };
obj = { [foo]: "foo" };
let blah;
obj = { blah };
obj = { blah };
obj = { a: b };

obj = {
	method() {
		console.log('hello');
	}
};

empty = {};
opts = opts || {};

obj = {
	get foo() {
		return _foo;
	},
	set foo(value) {
		_foo = value;
	},
	get [foo]() {
		return _foo;
	},
	set [foo](value) {
		_foo = value;
	}
};