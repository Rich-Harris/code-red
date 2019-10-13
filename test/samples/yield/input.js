module.exports = ({ b }) => b`
function* foo() {
	yield;
}

function* bar() {
	yield* 1;
}
`;