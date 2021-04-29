export default ({ b }) => b`
function* foo() {
	yield;
}

function* bar() {
	yield* 1;
}
`;