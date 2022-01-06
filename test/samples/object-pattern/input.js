export default ({ x }) => x`
function add() {
    let a = () => ({ x } = { x: 42 });
}`;
