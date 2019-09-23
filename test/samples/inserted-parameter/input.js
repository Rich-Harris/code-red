module.exports = ({ x }) => {
	const param = x`bar`;

	return x`function foo(${param}) {
		return ${param} * 2;
	}`;
};