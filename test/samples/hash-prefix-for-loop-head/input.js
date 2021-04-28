export default ({ x, b }) => {
	const i = x`i`;

	return b`
		for (let #i = 0; #i < 10; #i += 1) {
			console.log(${i} * #i);
		}`;
};