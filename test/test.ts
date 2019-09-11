import * as assert from 'assert';
import { x, b, print } from '../src/index';

const d = (str: string) => str.replace(/^\t{5}/gm, '').trim();

describe('codered', () => {
	describe('b', () => {
		it('creates a block of nodes', () => {
			assert.deepEqual(b`
				a = b + c;
				d = e + f;
			`, [
				{
					type: 'ExpressionStatement',
					expression: {
						type: 'AssignmentExpression',
						left: { type: 'Identifier', name: 'a' },
						operator: '=',
						right: {
							type: 'BinaryExpression',
							left: { type: 'Identifier', name: 'b' },
							operator: '+',
							right: { type: 'Identifier', name: 'c' },
						}
					}
				},
				{
					type: 'ExpressionStatement',
					expression: {
						type: 'AssignmentExpression',
						left: { type: 'Identifier', name: 'd' },
						operator: '=',
						right: {
							type: 'BinaryExpression',
							left: { type: 'Identifier', name: 'e' },
							operator: '+',
							right: { type: 'Identifier', name: 'f' },
						}
					}
				}
			]);
		});

		it('ignores falsy values', () => {
			assert.deepEqual(b`
				a++;
				${false}
				b++
			`, [
				{
					type: 'ExpressionStatement',
					expression: {
						type: 'UpdateExpression',
						operator: '++',
						prefix: false,
						argument: { type: 'Identifier', name: 'a' }
					}
				},
				{
					type: 'ExpressionStatement',
					expression: {
						type: 'UpdateExpression',
						operator: '++',
						prefix: false,
						argument: { type: 'Identifier', name: 'b' }
					}
				}
			]);
		});

		it('unwraps arrays', () => {
			const vars = [x`a`, x`b`, x`c`];
			const declarations = vars.map(v => b`console.log(${v})`);

			const fn: any = x`function foo() {
				${declarations}
			}`;

			const call = name => ({
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					callee: {
						type: 'MemberExpression',
						object: { type: 'Identifier', name: 'console' },
						property: { type: 'Identifier', name: 'log' },
						computed: false
					},
					arguments: [
						{ type: 'Identifier', name }
					]
				}
			});

			assert.deepEqual(fn.body.body, [
				call('a'),
				call('b'),
				call('c')
			]);
		});
	});

	describe('x', () => {
		it('creates a single expression', () => {
			assert.deepEqual(x`
				a = b + c
			`, {
				type: 'AssignmentExpression',
				left: { type: 'Identifier', name: 'a' },
				operator: '=',
				right: {
					type: 'BinaryExpression',
					left: { type: 'Identifier', name: 'b' },
					operator: '+',
					right: { type: 'Identifier', name: 'c' },
				}
			});
		});

		it('inserts values', () => {
			const name = { x: 'name' };
			const param = { x: 'param' };

			const node = x`
				function ${name}(${param}) {
					return ${param} * 2;
				}
			`;

			assert.deepEqual(node, {
				type: 'FunctionExpression',
				id: name,
				expression: false,
				generator: false,
				async: false,
				params: [
					param
				],
				body: {
					type: 'BlockStatement',
					body: [{
						type: 'ReturnStatement',
						argument: {
							type: 'BinaryExpression',
							left: param,
							operator: '*',
							right: { type: 'Literal', value: 2, raw: '2' }
						}
					}]
				}
			});
		});

		it('preserves @-prefixed names', () => {
			const node = x`@foo(bar)`;

			assert.deepEqual(node, {
				type: 'CallExpression',
				callee: { type: 'Identifier', name: '@foo' },
				arguments: [
					{ type: 'Identifier', name: 'bar' }
				]
			});

			const id = x`@foo`;

			assert.deepEqual(id, {
				type: 'Identifier',
				name: '@foo'
			});
		});

		it('preserves #-prefixed names', () => {
			const node = x`
				function foo(#bar) {
					return #bar * bar;
				}
			`;

			assert.deepEqual(node, {
				type: 'FunctionExpression',
				id: { type: 'Identifier', name: 'foo' },
				expression: false,
				generator: false,
				async: false,
				params: [
					{ type: 'Identifier', name: '#bar' }
				],
				body: {
					type: 'BlockStatement',
					body: [{
						type: 'ReturnStatement',
						argument: {
							type: 'BinaryExpression',
							left: { type: 'Identifier', name: '#bar' },
							operator: '*',
							right: { type: 'Identifier', name: 'bar' }
						}
					}]
				}
			});
		});

		it('flattens parameters', () => {
			const args = [
				x`a`,
				x`b`
			];

			const fn = x`function (${args}) {
				return a + b;
			}`;

			assert.deepEqual(fn, {
				type: 'FunctionExpression',
				id: null,
				expression: false,
				generator: false,
				async: false,
				params: [
					{ type: 'Identifier', name: 'a' },
					{ type: 'Identifier', name: 'b' }
				],
				body: {
					type: 'BlockStatement',
					body: [{
						type: 'ReturnStatement',
						argument: {
							type: 'BinaryExpression',
							left: { type: 'Identifier', name: 'a' },
							operator: '+',
							right: { type: 'Identifier', name: 'b' }
						}
					}]
				}
			})
		});

		it(`replaces strings`, () => {
			const name = 'world';
			const expression = x`hello("${name}")`;

			assert.equal((expression as any).arguments[0].value, 'world');
		});

		it(`allows strings in place of identifiers`, () => {
			const name = 'world';
			const expression = x`hello(${name})`;

			assert.deepEqual((expression as any).arguments[0], {
				type: 'Identifier',
				name: 'world'
			});
		});
	});

	describe('print', () => {
		it('prints a node', () => {
			const node = x`a  =  (b + c)`;

			const { code } = print(node);

			assert.equal(code, `a = b + c`);
		});

		it('prints a function with single inserted parameter', () => {
			const param = x`bar`;

			const node = x`function foo(${param}) {
				return ${param} * 2;
			}`;

			const { code } = print(node);

			assert.equal(
				code,
				d(`
					function foo(bar) {
						return bar * 2;
					}
				`)
			);
		});

		it('prints a function with multiple inserted parameters', () => {
			const bar = x`bar`;
			const baz = x`baz`;

			const params = [bar, baz];

			const node = x`function foo(${params}) {
				return ${bar} * ${baz};
			}`;

			const { code } = print(node);

			assert.equal(
				code,
				d(`
					function foo(bar, baz) {
						return bar * baz;
					}
				`)
			);
		});

		it('replaces @-prefixed names', () => {
			const node = x`@foo(bar)`;

			const { code } = print(node, {
				getName: (name: string) => name.toUpperCase()
			});

			assert.equal(code, 'FOO(bar)');
		});

		it('deconflicts #-prefixed names', () => {
			const node = x`
				function foo(#bar) {
					return #bar * bar;
				}
			`;

			const { code } = print(node);

			assert.equal(
				code,
				d(`
					function foo(bar$1) {
						return bar$1 * bar;
					}
				`)
			);
		});
	});
});
