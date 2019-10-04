module.exports = ({ b }) => b`
props = {
	foo: '"></div><script>alert(42)</' + 'script>',
	bar: "'></div><script>alert(42)</" + 'script>',
	['"></div><script>alert(42)</' + 'script>']: 'baz'
};
`;