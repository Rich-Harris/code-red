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
		enter(node, parent, key, index) {
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
		}
	});
}

export function b(strings: TemplateStringsArray, ...values: any[]) {
	const ast: any = acorn.parse(join(strings), {
		ecmaVersion: 2019,
		sourceType: 'module'
	});

	inject(ast, values);

	return ast.body;
}

export function x(strings: TemplateStringsArray, ...values: any[]) {
	const expression = acorn.parseExpressionAt(join(strings));

	inject(expression, values);

	return expression;
}

export { print } from './print/index';