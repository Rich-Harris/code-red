export default ({ b }) => b`
function foo() {
	let i = 2;

	for (var #i = 0; #i <10; #i += 1) {
		console.log(#i * i);
	}
}`;