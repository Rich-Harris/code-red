export default ({ x }) => {
	const bar = x`bar`;
	const baz = x`baz`;

	const params = [bar, baz];

	return x`function foo(${params}) {
		return ${bar} * ${baz};
	}`;
};