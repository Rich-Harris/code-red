module.exports = ({ b, p }) => {
	const x = p`a:b`;

	return b`
		obj = {
			foo: foo,
			bar,
			baz: qux
		};

		obj = { ${x} }

		obj = {
			method: function() {
				console.log('hello');
			}
		}

		empty = {  }

		opts = opts || {}`; // TODO would be nice if the {} didn't become ({})
};