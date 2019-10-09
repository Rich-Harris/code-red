const acorn = require('acorn');

module.exports = ({ b, x }) => {
	const decl = acorn.parse(`function foo(value) {
		console.log(value);
	}`, {
		locations: true
	}).body[0];


	return b`
		const a = 42;

		${decl}

		foo(a);
	`;
}