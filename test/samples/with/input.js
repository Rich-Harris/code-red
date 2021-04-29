export default () => ({
	type: 'WithStatement',
	start: 0,
	end: 17,
	object: {
		type: 'Identifier',
		start: 6,
		end: 9,
		name: 'foo'
	},
	body: {
		type: 'ExpressionStatement',
		start: 11,
		end: 17,
		expression: {
			type: 'CallExpression',
			start: 11,
			end: 16,
			callee: {
				type: 'Identifier',
				start: 11,
				end: 14,
				name: 'bar'
			},
			arguments: []
		}
	}
})