import * as acorn from 'acorn';
import { walk } from 'estree-walker';
import { Property, Node, ObjectExpression, Expression, SpreadElement } from 'estree';
import { id, re } from './utils/id';
import { get_comment_handlers, CommentWithLocation } from './utils/comments';

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
				// TODO this is hacktacular
				let node = statement.expression[0];
				while (Array.isArray(node)) node = node[0];
				if (node) node.leadingComments = statement.leadingComments;

				flatten_body(statement.expression, target);
				continue;
			}

			if (/(Expression|Literal)$/.test(statement.expression.type)) {
				target.push(statement);
				continue;
			}

			if (statement.leadingComments) statement.expression.leadingComments = statement.leadingComments;
			if (statement.trailingComments) statement.expression.trailingComments = statement.trailingComments;

			target.push(statement.expression);
			continue;
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

const acorn_opts = (comments: CommentWithLocation[], raw: string) => {
	const { onComment } = get_comment_handlers(comments, raw);
	return {
		ecmaVersion: 2020,
		sourceType: 'module',
		allowAwaitOutsideFunction: true,
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		onComment
	} as any;
};

const inject = (raw: string, node: Node, values: any[], comments: CommentWithLocation[]) => {
	comments.forEach(comment => {
		comment.value = comment.value.replace(re, (m, i) => +i in values ? values[+i] : m);
	});

	const { enter, leave } = get_comment_handlers(comments, raw);

	walk(node, {
		enter,

		leave(node, parent, key, index) {
			if (node.type === 'Identifier') {
				re.lastIndex = 0;
				const match = re.exec(node.name);

				if (match) {
					if (match[1]) {
						if (+match[1] in values) {
							let value = values[+match[1]];

							if (typeof value === 'string') {
								value = { type: 'Identifier', name: value, leadingComments: node.leadingComments, trailingComments: node.trailingComments };
							} else if (typeof value === 'number') {
								value = { type: 'Literal', value, leadingComments: node.leadingComments, trailingComments: node.trailingComments };
							}

							this.replace(value || EMPTY);
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

			leave(node);
		}
	});
}

export function b(strings: TemplateStringsArray, ...values: any[]): Node[] {
	const str = join(strings);
	const comments: CommentWithLocation[] = [];

	try {
		const ast: any = acorn.parse(str,  acorn_opts(comments, str));

		inject(str, ast, values, comments);

		return ast.body;
	} catch (err) {
		handle_error(str, err);
	}
}

export function x(strings: TemplateStringsArray, ...values: any[]): Expression {
	const str = join(strings);
	const comments: CommentWithLocation[] = [];

	try {
		const expression = acorn.parseExpressionAt(str, 0, acorn_opts(comments, str)) as Expression;
		const match = /\S+/.exec(str.slice((expression as any).end));
		if (match) {
			throw new Error(`Unexpected token '${match[0]}'`);
		}

		inject(str, expression, values, comments);

		return expression;
	} catch (err) {
		handle_error(str, err);
	}
}

export function p(strings: TemplateStringsArray, ...values: any[]): Property | SpreadElement {
	const str = `{${join(strings)}}`;
	const comments: CommentWithLocation[] = [];

	try {
		const expression = acorn.parseExpressionAt(str, 0, acorn_opts(comments, str)) as unknown as ObjectExpression;

		inject(str, expression, values, comments);

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

export const parse = (source: string, opts: any): any => {
	const comments: CommentWithLocation[] = [];
	const { onComment, enter, leave } = get_comment_handlers(comments, source);
	const ast = acorn.parse(source, { onComment, ...opts });
	walk(ast as any, { enter, leave });
	return ast;
};

export const parseExpressionAt = (source: string, index: number, opts: any): any => {
	const comments: CommentWithLocation[] = [];
	const { onComment, enter, leave } = get_comment_handlers(comments, source);
	const ast = acorn.parseExpressionAt(source, index, { onComment, ...opts });
	walk(ast as any, { enter, leave });
	return ast;
};
