export default ({ b, x }) => {
	const vars = [{ id: x`foo`, init: x`bar` }];

	const return_value = x`{
		hello: 'world'
	}`;

	const returned = b`return ${return_value};`;

	return b`
		${vars.map(({ id, init }) => {
			return init
				? b`let ${id} = ${init}`
				: b`let ${id}`;
		})}

		${returned}
	`;
};