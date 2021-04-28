import * as fs from 'fs';
import * as assert from 'assert';
import * as acorn from 'acorn';
import { generateRandomJS } from 'eslump';
import * as codered from '../src/index';
import { ObjectExpression, Identifier, Node } from 'estree';
import { walk } from 'estree-walker';
import { decode } from 'sourcemap-codec';

const d = (str: string) => str.replace(/^\t{5}/gm, '').trim();

// just to make the tests less messy
const remove_ranges = ast => {
	walk(ast, {
		enter(node) {
			delete node.start;
			delete node.end;
		}
	});
	return ast;
};

const b = (s, ...v) => remove_ranges(codered.b(s, ...v));
const x = (s, ...v) => remove_ranges(codered.x(s, ...v));
const p = (s, ...v) => remove_ranges(codered.p(s, ...v));
const print = codered.print;

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
						optional: false,
						computed: false
					},
					arguments: [
						{ type: 'Identifier', name }
					],
					optional: false
				}
			});

			assert.deepEqual(fn.body.body, [
				{ leadingComments: undefined, ...call('a') },
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
				],
				optional: false
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
				value: 42,
				leadingComments: undefined,
				trailingComments: undefined
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
				name: 'world',
				leadingComments: undefined,
				trailingComments: undefined
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

		it('flattens patterns', () => {
			const props = [p`a`, p`b`, p`c`];
			const declaration = b`const { ${props} } = obj;`[0];

			assert.deepEqual(declaration, {
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [{
					type: 'VariableDeclarator',
					id: {
						type: 'ObjectPattern',
						properties: ['a', 'b', 'c'].map(name => {
							const id = { type: 'Identifier', name };
							return {
								type: 'Property',
								kind: 'init',
								method: false,
								computed: false,
								shorthand: true,
								key: id,
								value: id
							};
						})
					},
					init: {
						type: 'Identifier',
						name: 'obj'
					}
				}]
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

		it('preserves locations of original nodes in a sourcemap', () => {
			const answer = {
				type: 'Literal',
				value: 42,
				raw: '42',
				loc: {
					start: { line: 10, column: 5 },
					end: { line: 10, column: 7 }
				}
			};

			const expression = x`console.log(${answer})`;

			const { code, map } = print(expression, {
				sourceMapSource: 'input.js'
			});

			assert.equal(code, `console.log(42)`);

			assert.deepEqual(map, {
				version: 3,
				sources: ['input.js'],
				sourcesContent: [null],
				names: [],
				mappings: 'YASK,EAAE'
			});
		});

		it('errors on invalid expressions', () => {
			assert.throws(() => {
				x`this is broken`;
			}, /Unexpected token 'is'/);
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
		const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;

		fs.readdirSync('test/samples').forEach(dir => {
			it(dir, () => {
				if (dir[0] === '.') return;
				const input = require(`./samples/${dir}/input.js`)({ b, x, p });

				const expected = {
					code: read(`test/samples/${dir}/expected.js`),
					map: JSON.parse(read(`test/samples/${dir}/expected.js.map`) || '{}')
				};

				const actual = print(input, {
					sourceMapSource: 'input.js',
					getName: name => name.toUpperCase()
				});

				fs.writeFileSync(`test/samples/${dir}/_actual.js`, actual.code);
				fs.writeFileSync(`test/samples/${dir}/_actual.js.map`, actual.map.toString());

				assert.equal(actual.code.replace(/\t+$/gm, ''), expected.code.replace(/\t+$/gm, ''));
				assert.deepEqual(actual.map, expected.map);
			});
		});

		it('throws on unhandled sigils', () => {
			assert.throws(() => print(b`let foo = @bar;`), { message: 'Unhandled sigil @bar' });
		});

		it('can return sourcemap with decoded mappings', () => {
				const dir = 'sourcemap';
				const input = require(`./samples/${dir}/input.js`)({ b, x, p });

				const expected = {
					code: read(`test/samples/${dir}/expected.js`),
					map: JSON.parse(read(`test/samples/${dir}/expected.js.map`) || '{}')
				};
				if (expected.map && expected.map.mappings) {
					expected.map.mappings = decode(expected.map.mappings);
				}

				const actual = print(input, {
					sourceMapSource: 'input.js',
					getName: name => name.toUpperCase(),
					sourceMapEncodeMappings: false
				});

				assert.deepEqual(actual.map, expected.map);
		});

		it.skip('passes fuzz testing', () => {
			for (let i = 0; i < 100; i += 1) {
				const js = generateRandomJS({
					sourceType: "module",
					maxDepth: 7,
					comments: false
				});

				let ast1: Node;
				try {
					ast1 = acorn.parse(js, {
						sourceType: 'module',
						ecmaVersion: 2019
					}) as Node;
				} catch {
					continue;
				}

				let printed;

				try {
					printed = print(ast1);
				} catch (err) {
					fs.writeFileSync(`test/fuzz/report.js`, js);
					throw err;
				}

				const ast2: Node = acorn.parse(printed.code, {
					sourceType: 'module',
					ecmaVersion: 2019
				}) as Node;

				[ast1, ast2].forEach(ast => {
					walk(ast, {
						enter(node: any) {
							delete node.start;
							delete node.end;
						}
					});
				});

				try {
					assert.deepEqual(ast1, ast2);
				} catch (err) {
					fs.writeFileSync(`test/fuzz/report.js`, `// input\n${js}\n\n// output\n${printed.code}`);
					throw err;
				}
			}
		});
	});
});
