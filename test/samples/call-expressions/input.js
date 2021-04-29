export default ({ b }) => b`
x(a, b, c);

x(a, b, () => {
	console.log('c');
});

x(a, () => {
	console.log('b');
}, () => {
	console.log('c');
});
`;