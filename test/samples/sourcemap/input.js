import * as acorn from 'acorn';

export default ({ b, x }) => {
	const decl = acorn.parse(`function foo(value) {
		console.log(value);
	}`, {
		locations: true,
		ecmaVersion: 2020
	}).body[0];


	return b`
		const a = 42;

		${decl}

		foo(a);
	`;
}