export default ({ b }) => b`
function foo() {
	console.log(new.target);
}
`;