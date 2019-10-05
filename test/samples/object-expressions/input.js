module.exports = ({ b, p }) => {
	const x = p`a:b`;

	return b`
		obj = {
			foo: foo,
			bar,
			baz: qux
		};

		obj = { ${x} }`;
};