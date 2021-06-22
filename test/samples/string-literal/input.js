export default ({ b }) => {
	const value = 'foo';
	const multiline = `
		a
		b
		c
	`;
	
	return b`
		let a = '${value}';
		let b = "${value}";
		let c = \`${value}\`;
		let d = '${multiline}';
		let e = "${multiline}";
		let f = \`${multiline}\`;
	`;
};
