import * as assert from 'assert';
import { x, b, p, print } from '../src/index';
import { ObjectExpression, Identifier } from 'estree';

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

		it(`replaces numbers`, () => {
			const answer = 42;
			const expression = x`console.log("the answer is", ${answer})`;

			assert.deepEqual((expression as any).arguments[1], {
				type: 'Literal',
				value: 42
			});
		});

		it(`replaces strings in template literals`, () => {
			const foo = 'bar';
			const expression = x`\`${foo}\``;

			assert.equal((expression as any).quasis[0].value.raw, 'bar');
		});

		it(`allows strings in place of identifiers`, () => {
			const name = 'world';
			const expression = x`hello(${name})`;

			assert.deepEqual((expression as any).arguments[0], {
				type: 'Identifier',
				name: 'world'
			});
		});

		it('flattens arrays', () => {
			const vars = [x`a`, x`b`, x`c`];
			const arr = x`[${vars}]`;

			assert.deepEqual(arr, {
				type: 'ArrayExpression',
				elements: ['a', 'b', 'c'].map(name => ({
					type: 'Identifier',
					name
				}))
			});
		});

		it('flattens objects', () => {
			const props = [p`a`, p`b`, p`c`];
			const obj = x`{${props}}`;

			assert.deepEqual(obj, {
				type: 'ObjectExpression',
				properties: ['a', 'b', 'c'].map(name => {
					const id = { type: 'Identifier', name };
					return {
						type: 'Property',
						kind: 'init',
						method: false,
						shorthand: true,
						computed: false,
						key: id,
						value: id
					};
				})
			});
		});

		it('removes falsy properties from an object', () => {
			const obj: ObjectExpression = x`{
				a: 1,
				b: ${false}
			}`;

			assert.equal(obj.properties.length, 1);
			assert.equal((obj.properties[0].key as Identifier).name, 'a');
		});
	});

	describe('p', () => {
		it('creates a regular object property', () => {
			const obj = x`{}` as ObjectExpression;
			obj.properties.push(p`foo: 'bar'`);

			assert.deepEqual(obj, {
				type: 'ObjectExpression',
				properties: [{
					type: 'Property',
					kind: 'init',
					method: false,
					shorthand: false,
					computed: false,
					key: { type: 'Identifier', name: 'foo' },
					value: { type: 'Literal', value: 'bar', raw: "'bar'" }
				}]
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

		it('deconflicts #-prefixed names when node is reused', () => {
			const bar = x`#bar`;

			const node = x`
				function foo(#bar) {
					const bar = 'x';

					${bar} += 1;

					return (#bar) => {
						console.log(${bar});
					};
				}
			`;

			const { code } = print(node);

			assert.equal(
				code,
				d(`
					function foo(bar$1) {
						const bar = "x";
						bar$1 += 1;
						return bar => {
							console.log(bar);
						};
					}
				`)
			);
		});

		it('handles #-prefixed names in arrow functions', () => {
			const body: any = b`const foo = #bar => #bar * 2`;

			const { code } = print({
				type: 'Program',
				body
			} as any);

			assert.equal(
				code.trim(),
				d(`
					const foo = bar => bar * 2;
				`)
			);
		});

		it('handles #-prefixed names in for loop heads', () => {
			const i = x`i`;

			const body: any = b`
				for (let #i = 0; #i < 10; #i += 1) {
					console.log(${i} * #i);
				}`;

			const { code } = print({
				type: 'Program',
				body
			} as any);

			assert.equal(
				code.trim(),
				d(`
					for (let i$1 = 0; i$1 < 10; i$1 += 1) {
						console.log(i * i$1);
					}
				`)
			);
		});
	});
});
