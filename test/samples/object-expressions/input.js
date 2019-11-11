module.exports = ({ b, p }) => {
	const x = p`a:b`;

	return b`
		obj = {
			foo: foo,
			bar,
			baz: qux
		};

		obj = { "1": "1" };

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