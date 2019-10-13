module.exports = ({ b }) => b`
function foo() {
	console.log(new.target);
}
`;