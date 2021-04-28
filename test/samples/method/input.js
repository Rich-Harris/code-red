export default ({ b }) => b`obj = {
	foo() {
		console.log('foo');
	},
	async bar() {
		console.log('bar');
	},
	baz: function* () {
		console.log('baz');
	}
}`;