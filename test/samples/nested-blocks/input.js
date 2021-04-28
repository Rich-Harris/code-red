export default ({ b }) => {
	const one = b`console.log(one);`;

	const two = b`
		${one}
		console.log(two);
	`;

	const three = b`
		${two}
		console.log(three);
	`;

	return b`
		${three}
		console.log(four);
	`;
};