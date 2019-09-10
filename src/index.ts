import * as acorn from 'acorn';
import { walk } from 'estree-walker';

const sigils: Record<string, string> = {
	'@': 'AT',
	'#': 'HASH'
};

const join = (strings: TemplateStringsArray) => {
	let str = strings[0];
	for (let i = 1; i < strings.length; i += 1) {
		str += `___${i - 1}___${strings[i]}`;
	}
	return str.replace(/([@#])(\w+)/g, (_m, sigil: string, name: string) => `___${sigils[sigil]}___${name}`);
}

const inject = (node: acorn.Node, values: any[]) => {
	walk(node, {
		leave(node, parent, key, index) {
			delete node.start;
			delete node.end;

			if (node.type === 'Identifier') {
				const match = /___(?:(\d+)|(AT)|(HASH))___(\w+)?/.exec(node.name);

				if (match) {
					const value = match[1]
						? +match[1] in values ? values[+match[1]] : match[1]
						: { type: 'Identifier', name: `${match[2] ? `@` : `#`}${match[4]}` };

					if (index === null) {
						parent[key] = value;
					} else {
						parent[key][index] = value;
					}
				}
			}

			if (node.type === 'Program' || node.type === 'BlockStatement') {
				const body = node.body.filter((statement: any) => {
					if (statement.type !== 'ExpressionStatement') return true;
					return !!statement.expression;
				});

				node.body = body;
			}
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
		console.log(str); // TODO proper error reporting
		throw err;
	}
}

export function x(strings: TemplateStringsArray, ...values: any[]) {
	const str = join(strings);

	try {
		const expression = acorn.parseExpressionAt(str);

		inject(expression, values);

		return expression;
	} catch (err) {
		console.log(str); // TODO proper error reporting
		throw err;
	}
}

export { print } from './print/index';