export default ({ b, p }) => {
	const x = p`a:b`;

	return b`
		obj = {
			foo: foo,
			bar,
			baz: qux
		};

		obj = { "1": "1" };

		obj = { true: true };

		obj = { "foo": foo };

		obj = { [foo]: foo };

		obj = { [foo]: "foo" };

		let #blah;
		obj = { blah: #blah };
		obj = { 'blah': #blah };

		obj = { ${x} }

		obj = {
			method: function() {
				console.log('hello');
			}
		}

		empty = {  }

		opts = opts || {}

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
		}`; // TODO would be nice if the {} didn't become ({})
};
