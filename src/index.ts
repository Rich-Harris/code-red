import * as acorn from 'acorn';
import { walk } from 'estree-walker';
import { Property, Node, ObjectExpression, Expression } from 'estree';

// generate an ID that is, to all intents and purposes, unique
const id = (Math.round(Math.random() * 1e20)).toString(36);
const re = new RegExp(`_${id}_(?:(\\d+)|(AT)|(HASH))_(\\w+)?`, 'g');

const sigils: Record<string, string> = {
	'@': 'AT',
	'#': 'HASH'
};

const join = (strings: TemplateStringsArray) => {
	let str = strings[0];
	for (let i = 1; i < strings.length; i += 1) {
		str += `_${id}_${i - 1}_${strings[i]}`;
	}
	return str.replace(/([@#])(\w+)/g, (_m, sigil: string, name: string) => `_${id}_${sigils[sigil]}_${name}`);
};

const flatten_body = (array: any[], target: any[]) => {
	for (let i = 0; i < array.length; i += 1) {
		const statement = array[i];
		if (Array.isArray(statement)) {
			flatten_body(statement, target);
			continue;
		}

		if (statement.type === 'ExpressionStatement') {
			if (statement.expression === EMPTY) continue;

			if (Array.isArray(statement.expression)) {
				flatten_body(statement.expression, target);
				continue;
			}

			if (!/Expression$/.test(statement.expression.type)) {
				target.push(statement.expression);
				continue;
			}
		}

		target.push(statement);
	}

	return target;
}

const flatten_properties = (array: any[], target: any[]) => {
	for (let i = 0; i < array.length; i += 1) {
		const property = array[i];

		if (property.value === EMPTY) continue;

		if (property.key === property.value && Array.isArray(property.key)) {
			flatten_properties(property.key, target);
			continue;
		}

		target.push(property);
	}

	return target;
}

const flatten = (nodes: any[], target: any[]) => {
	for (let i = 0; i < nodes.length; i += 1) {
		const node = nodes[i];

		if (node === EMPTY) continue;

		if (Array.isArray(node)) {
			flatten(node, target);
			continue;
		}

		target.push(node);
	}

	return target;
}

const EMPTY = { type: 'Empty' };

const inject = (node: Node, values: any[]) => {
	walk(node, {
		leave(node, parent, key, index) {
			if (node.type === 'Identifier') {
				re.lastIndex = 0;
				const match = re.exec(node.name);

				if (match) {
					if (match[1]) {
						if (+match[1] in values) {
							let value = values[+match[1]];

							if (typeof value === 'string') {
								value = { type: 'Identifier', name: value };
							} else if (typeof value === 'number') {
								value = { type: 'Literal', value };
							}

							if (index === null) {
								(parent as any)[key] = value || EMPTY;
							} else {
								(parent as any)[key][index] = value || EMPTY;
							}
						}
					} else {
						node.name = `${match[2] ? `@` : `#`}${match[4]}`;
					}
				}
			}

			if (node.type === 'Literal') {
				if (typeof node.value === 'string') {
					re.lastIndex = 0;
					node.value = node.value.replace(re, (m, i) => +i in values ? values[+i] : m);
				}
			}

			if (node.type === 'TemplateElement') {
				re.lastIndex = 0;
				node.value.raw = (node.value.raw as string).replace(re, (m, i) => +i in values ? values[+i] : m);
			}

			if (node.type === 'Program' || node.type === 'BlockStatement') {
				node.body = flatten_body(node.body, []);
			}

			if (node.type === 'ObjectExpression' || node.type === 'ObjectPattern') {
				node.properties = flatten_properties(node.properties, []);
			}

			if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
				node.elements = flatten(node.elements, []);
			}

			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') {
				node.params = flatten(node.params, []);
			}

			if (node.type === 'CallExpression' || node.type === 'NewExpression') {
				node.arguments = flatten(node.arguments, []);
			}

			if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') {
				node.specifiers = flatten(node.specifiers, []);
			}

			if (node.type === 'ForStatement') {
				node.init = node.init === EMPTY ? null : node.init;
				node.test = node.test === EMPTY ? null : node.test;
				node.update = node.update === EMPTY ? null : node.update;
			}
		}
	});
}

export function b(strings: TemplateStringsArray, ...values: any[]): Node[] {
	const str = join(strings);
	try {
		const ast: any = acorn.parse(str, {
			ecmaVersion: 11,
			sourceType: 'module',
			allowAwaitOutsideFunction: true,
			allowReturnOutsideFunction: true
		} as any);

		inject(ast, values);

		return ast.body;
	} catch (err) {
		handle_error(str, err);
	}
}

export function x(strings: TemplateStringsArray, ...values: any[]): Expression {
	const str = join(strings);

	try {
		const expression = acorn.parseExpressionAt(str, 0, {
			ecmaVersion: 11,
			sourceType: 'module',
			allowAwaitOutsideFunction: true,
			allowImportExportEverywhere: true
		} as any) as Expression;

		inject(expression, values);

		return expression;
	} catch (err) {
		handle_error(str, err);
	}
}

export function p(strings: TemplateStringsArray, ...values: any[]): Property {
	const str = `{${join(strings)}}`;

	try {
		const expression = acorn.parseExpressionAt(str, 0, {
			ecmaVersion: 11,
			sourceType: 'module',
			allowAwaitOutsideFunction: true,
			allowImportExportEverywhere: true
		} as any) as unknown as ObjectExpression;

		inject(expression, values);

		return expression.properties[0];
	} catch (err) {
		handle_error(str, err);
	}
}

function handle_error(str: string, err: Error) {
	// TODO location/code frame

	re.lastIndex = 0;

	str = str.replace(re, (m, i, at, hash, name) => {
		if (at) return `@${name}`;
		if (hash) return `#${name}`;

		return '${...}';
	});

	console.log(`failed to parse:\n${str}`);
	throw err;
}

export { print } from './print/index';