import * as acorn from 'acorn';
import { walk } from 'estree-walker';

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
			if (!statement.expression) continue;

			if (Array.isArray(statement.expression)) {
				flatten_body(statement.expression, target);
				continue;
			}
		}

		target.push(statement);
	}

	return target;
}

const flatten = (nodes: any[], target: any[]) => {
	for (let i = 0; i < nodes.length; i += 1) {
		const node = nodes[i];

		if (!node) continue;

		if (Array.isArray(node)) {
			flatten(node, target);
			continue;
		}

		target.push(node);
	}

	return target;
}

const inject = (node: acorn.Node, values: any[]) => {
	walk(node, {
		leave(node, parent, key, index) {
			delete node.start;
			delete node.end;

			if (node.type === 'Identifier') {
				re.lastIndex = 0;
				const match = re.exec(node.name);

				if (match) {
					if (match[1]) {
						if (+match[1] in values) {
							const value = values[+match[1]];

							if (index === null) {
								parent[key] = value;
							} else {
								parent[key][index] = value;
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

			if (node.type === 'Program' || node.type === 'BlockStatement') {
				node.body = flatten_body(node.body, []);
			}

			if (node.params) node.params = flatten(node.params, []);
			if (node.arguments) node.arguments = flatten(node.arguments, []);
			if (node.specifiers) node.specifiers = flatten(node.specifiers, []);
		}
	});
}

export function b(strings: TemplateStringsArray, ...values: any[]) {
	const str = join(strings);
	try {
		const ast: any = acorn.parse(str, {
			ecmaVersion: 2019,
			sourceType: 'module',
			allowAwaitOutsideFunction: true,
			allowReturnOutsideFunction: true
		});

		inject(ast, values);

		return ast.body;
	} catch (err) {
		console.log(`failed to parse:\n${str}`); // TODO proper error reporting
		throw err;
	}
}

export function x(strings: TemplateStringsArray, ...values: any[]) {
	const str = join(strings);

	try {
		const expression = acorn.parseExpressionAt(str, 0, {
			allowAwaitOutsideFunction: true,
			allowImportExportEverywhere: true,
			allowReturnOutsideFunction: true
		});

		inject(expression, values);

		return expression;
	} catch (err) {
		console.log(`failed to parse:\n${str}`); // TODO proper error reporting
		throw err;
	}
}

export { print } from './print/index';