export default ({ x }) => {
	const bar = x`#bar`;

	return x`
		function foo(#bar) {
			const bar = 'x';

			${bar} += 1;

			return (#bar) => {
				console.log(${bar});
			};
		}
	`;
};