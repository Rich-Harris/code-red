import * as acorn from 'acorn';
import { walk } from 'estree-walker';

const join = (strings: TemplateStringsArray) => {
	let str = strings[0];
	for (let i = 1; i < strings.length; i += 1) {
		str += `___${i - 1}___${strings[i]}`;
	}
	return str;
}

const inject = (node: acorn.Node, values: any[]) => {
	walk(node, {
		enter(node, parent, key, index) {
			delete node.start;
			delete node.end;

			if (node.type === 'Identifier') {
				const match = /___(\d+)___/.exec(node.name);
				if (match && +match[1] in values) {
					if (index === null) {
						parent[key] = values[+match[1]];
					} else {
						parent[key][index] = values[+match[1]];
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