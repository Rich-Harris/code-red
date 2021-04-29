export default ({ b, x }) => {
	const insert = b`"use strict";`;

	const node = {
		type: 'ImportDeclaration',
		specifiers: [{
			type: 'ImportSpecifier',
			local: { type: 'Identifier', name: 'foo' },
			imported: { type: 'Identifier', name: 'foo' }
		}],
		source: { type: 'Literal', value: 'wherever' }
	};

	return b`
		// comment before an inserted block
		${insert}

		// comment before an inserted node
		${node}
	`;
};