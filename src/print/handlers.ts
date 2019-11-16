// heavily based on https://github.com/davidbonnet/astring
// released under MIT license https://github.com/davidbonnet/astring/blob/master/LICENSE

import {
	Comment,
	Node,
	CallExpression,
	Program,
	ExpressionStatement,
	Identifier,
	ObjectExpression,
	Property,
	Literal,
	RegExpLiteral,
	AssignmentExpression,
	BinaryExpression,
	FunctionDeclaration,
	BlockStatement,
	ReturnStatement,
	IfStatement,
	LabeledStatement,
	BreakStatement,
	ContinueStatement,
	WithStatement,
	SwitchStatement,
	ThrowStatement,
	TryStatement,
	WhileStatement,
	DoWhileStatement,
	ForStatement,
	VariableDeclaration,
	VariableDeclarator,
	ClassDeclaration,
	ImportDeclaration,
	ExportDefaultDeclaration,
	ExportNamedDeclaration,
	ExportAllDeclaration,
	MethodDefinition,
	ArrowFunctionExpression,
	RestElement,
	YieldExpression,
	AwaitExpression,
	TaggedTemplateExpression,
	TemplateLiteral,
	ArrayExpression,
	ObjectPattern,
	SequenceExpression,
	UnaryExpression,
	UpdateExpression,
	Expression,
	AssignmentPattern,
	ConditionalExpression,
	NewExpression,
	MemberExpression,
	MetaProperty,
	ForInStatement,
	ImportSpecifier,
	ForOfStatement,
	FunctionExpression
} from 'estree';
import { re } from '../utils/id';

type Chunk = {
	content: string;
	loc?: {
		start: { line: number; column: number; };
		end: { line: number; column: number; };
	};
	has_newline: boolean;
};

type Handler = (node: Node, state: State) => Chunk[];

type State = {
	indent: string;
	scope: any; // TODO import from periscopic
	scope_map: WeakMap<Node, any>;
	getName: (name: string) => string;
	deconflicted: WeakMap<Node, Map<string, string>>;
	comments: Comment[];
};

export function handle(node: Node, state: State): Chunk[] {
	const handler: Handler = handlers[node.type];

	if (!handler) {
		throw new Error(`Not implemented ${node.type}`);
	}

	const result = handler(node, state);

	if (node.leadingComments) {
		result.unshift(c(node.leadingComments.map(comment => comment.type === 'Block'
			? `/*${comment.value}*/${(comment as any).has_trailing_newline ? `\n${state.indent}` : ` `}`
			: `//${comment.value}${(comment as any).has_trailing_newline ? `\n${state.indent}` : ` `}`).join(``)));
	}

	if (node.trailingComments) {
		state.comments.push(node.trailingComments[0]); // there is only ever one
	}

	return result;
}

function c(content: string, node?: Node): Chunk {
	return {
		content,
		loc: node && node.loc,
		has_newline: /\n/.test(content)
	};
}

const OPERATOR_PRECEDENCE = {
	'||': 3,
	'&&': 4,
	'|': 5,
	'^': 6,
	'&': 7,
	'==': 8,
	'!=': 8,
	'===': 8,
	'!==': 8,
	'<': 9,
	'>': 9,
	'<=': 9,
	'>=': 9,
	in: 9,
	instanceof: 9,
	'<<': 10,
	'>>': 10,
	'>>>': 10,
	'+': 11,
	'-': 11,
	'*': 12,
	'%': 12,
	'/': 12,
	'**': 13,
};

// Enables parenthesis regardless of precedence
const NEEDS_PARENTHESES = 17;

const EXPRESSIONS_PRECEDENCE: Record<string, number> = {
	ArrayExpression: 20,
	TaggedTemplateExpression: 20,
	ThisExpression: 20,
	Identifier: 20,
	Literal: 18,
	TemplateLiteral: 20,
	Super: 20,
	SequenceExpression: 20,
	MemberExpression: 19,
	CallExpression: 19,
	NewExpression: 19,
	ArrowFunctionExpression: NEEDS_PARENTHESES,
	ClassExpression: NEEDS_PARENTHESES,
	FunctionExpression: NEEDS_PARENTHESES,
	ObjectExpression: NEEDS_PARENTHESES, // TODO this results in e.g. `o = o || {}` => `o = o || ({})`
	UpdateExpression: 16,
	UnaryExpression: 15,
	BinaryExpression: 14,
	LogicalExpression: 13,
	ConditionalExpression: 4,
	AssignmentExpression: 3,
	AwaitExpression: 2,
	YieldExpression: 2,
	RestElement: 1
};

function needs_parens(node: Expression, parent: BinaryExpression, is_right: boolean) {
	const precedence = EXPRESSIONS_PRECEDENCE[node.type];

	if (precedence === NEEDS_PARENTHESES) {
		return true;
	}

	const parent_precedence = EXPRESSIONS_PRECEDENCE[parent.type];

	if (precedence !== parent_precedence) {
		// Different node types
		return (
			(!is_right &&
				precedence === 15 &&
				parent_precedence === 14 &&
				parent.operator === '**') ||
			precedence < parent_precedence
		);
	}

	if (precedence !== 13 && precedence !== 14) {
		// Not a `LogicalExpression` or `BinaryExpression`
		return false;
	}

	if ((node as BinaryExpression).operator === '**' && parent.operator === '**') {
		// Exponentiation operator has right-to-left associativity
		return !is_right;
	}

	if (is_right) {
		// Parenthesis are used if both operators have the same precedence
		return (
			OPERATOR_PRECEDENCE[(node as BinaryExpression).operator] <=
			OPERATOR_PRECEDENCE[parent.operator]
		);
	}

	return (
		OPERATOR_PRECEDENCE[(node as BinaryExpression).operator] <
		OPERATOR_PRECEDENCE[parent.operator]
	);
}

function has_call_expression(node: Node) {
	while (node) {
		if (node.type[0] === 'CallExpression') {
			return true;
		} else if (node.type === 'MemberExpression') {
			node = node.object;
		} else {
			return false;
		}
	}
}

const has_newline = (chunks: Chunk[]) => {
	for (let i = 0; i < chunks.length; i += 1) {
		if (chunks[i].has_newline) return true;
	}
	return false;
};

const get_length = (chunks: Chunk[]) => {
	let total = 0;
	for (let i = 0; i < chunks.length; i += 1) {
		total += chunks[i].content.length;
	}
	return total;
};

const sum = (a: number, b: number) => a + b;

const join = (nodes: Chunk[][], separator: Chunk): Chunk[] => {
	if (nodes.length === 0) return [];
	const joined: Chunk[] = [...nodes[0]];
	for (let i = 1; i < nodes.length; i += 1) {
		joined.push(separator, ...nodes[i] as Chunk[]);
	}
	return joined;
};

const scoped = (fn: (node: Node, state: State) => Chunk[]) => {
	return (node: Node, state: State) => {
		return fn(node, {
			...state,
			scope: state.scope_map.get(node)
		});
	};
};

const deconflict = (name: string, names: Set<string>) => {
	const original = name;
	let i = 1;

	while (names.has(name)) {
		name = `${original}$${i++}`;
	}

	return name;
};

const handle_body = (nodes: Node[], state: State) => {
	const chunks = [];

	const body = nodes.map(statement => {
		const chunks = handle(statement, {
			...state,
			indent: state.indent
		});

		while (state.comments.length) {
			const comment = state.comments.shift();
			chunks.push(c(comment.type === 'Block'
			? ` /*${comment.value}*/`
			: ` //${comment.value}`));
		}

		return chunks;
	});

	let needed_padding = false;

	for (let i = 0; i < body.length; i += 1) {
		const needs_padding = has_newline(body[i]);

		if (i > 0) {
			chunks.push(
				c(needs_padding || needed_padding ? `\n\n${state.indent}` : `\n${state.indent}`)
			);
		}

		chunks.push(
			...body[i]
		);

		needed_padding = needs_padding;
	}

	return chunks;
};

const handle_var_declaration = (node: VariableDeclaration, state: State) => {
	const chunks = [c(`${node.kind} `)];

	const declarators = node.declarations.map(d => handle(d, {
		...state,
		indent: state.indent + (node.declarations.length === 1 ? '' : '\t')
	}));

	const multiple_lines = (
		declarators.some(has_newline) ||
		(declarators.map(get_length).reduce(sum, 0) + (state.indent.length + declarators.length - 1) * 2) > 80
	);

	const separator = c(multiple_lines ? `,\n${state.indent}\t` : ', ');

	if (multiple_lines) {
		chunks.push(...join(declarators, separator));
	} else {
		chunks.push(
			...join(declarators, separator)
		);
	}

	return chunks;
};

const handlers: Record<string, Handler> = {
	Program(node: Program, state) {
		return handle_body(node.body, state);
	},

	BlockStatement: scoped((node: BlockStatement, state: State) => {
		return [
			c(`{\n${state.indent}\t`),
			...handle_body(node.body, { ...state, indent: state.indent + '\t' }),
			c(`\n${state.indent}}`)
		];
	}),

	EmptyStatement(node, state) {
		return [];
	},

	ExpressionStatement(node: ExpressionStatement, state) {
		const precedence = EXPRESSIONS_PRECEDENCE[node.expression.type]
		if (
			precedence === NEEDS_PARENTHESES ||
			(precedence === 3 && (node.expression as AssignmentExpression).left.type === 'ObjectPattern')
		) {
			// Should always have parentheses or is an AssignmentExpression to an ObjectPattern
			return [
				c('('),
				...handle(node.expression, state),
				c(');')
			];
		}

		return [
			...handle(node.expression, state),
			c(';')
		];
	},

	IfStatement(node: IfStatement, state) {
		const chunks = [
			c('if ('),
			...handle(node.test, state),
			c(') '),
			...handle(node.consequent, state)
		];

		if (node.alternate) {
			chunks.push(
				c(' else '),
				...handle(node.alternate, state)
			);
		}

		return chunks;
	},

	LabeledStatement(node: LabeledStatement, state) {
		return [
			...handle(node.label, state),
			c(': '),
			...handle(node.body, state)
		];
	},

	BreakStatement(node: BreakStatement, state) {
		return node.label
			? [c('break '), ...handle(node.label, state), c(';')]
			: [c('break;')];
	},

	ContinueStatement(node: ContinueStatement, state) {
		return node.label
			? [c('continue '), ...handle(node.label, state), c(';')]
			: [c('continue;')];
	},

	WithStatement(node: WithStatement, state) {
		return [
			c('with ('),
			...handle(node.object, state),
			c(') '),
			...handle(node.body, state)
		];
	},

	SwitchStatement(node: SwitchStatement, state) {
		const chunks = [
			c('switch ('),
			...handle(node.discriminant, state),
			c(') {')
		];

		node.cases.forEach(block => {
			if (block.test) {
				chunks.push(
					c(`\n${state.indent}\tcase `),
					...handle(block.test, { ...state, indent: `${state.indent}\t` }),
					c(':')
				);
			} else {
				chunks.push(c(`\n${state.indent}\tdefault:`))
			}

			block.consequent.forEach(statement => {
				chunks.push(
					c(`\n${state.indent}\t\t`),
					...handle(statement, { ...state, indent: `${state.indent}\t\t` })
				);
			});
		});

		chunks.push(c(`\n${state.indent}}`));

		return chunks;
	},

	ReturnStatement(node: ReturnStatement, state) {
		if (node.argument) {
			return [
				c('return '),
				...handle(node.argument, state),
				c(';')
			];
		} else {
			return [c('return;')];
		}
	},

	ThrowStatement(node: ThrowStatement, state) {
		return [
			c('throw '),
			...handle(node.argument, state),
			c(';')
		];
	},

	TryStatement(node: TryStatement, state) {
		const chunks = [
			c('try '),
			...handle(node.block, state)
		];

		if (node.handler) {
			if (node.handler.param) {
				chunks.push(
					c(' catch('),
					...handle(node.handler.param, state),
					c(') ')
				);
			} else {
				chunks.push(c(' catch '));
			}

			chunks.push(...handle(node.handler.body, state));
		}

		if (node.finalizer) {
			chunks.push(c(' finally '), ...handle(node.finalizer, state));
		}

		return chunks;
	},

	WhileStatement(node: WhileStatement, state) {
		return [
			c('while ('),
			...handle(node.test, state),
			c(') '),
			...handle(node.body, state)
		];
	},

	DoWhileStatement(node: DoWhileStatement, state) {
		return [
			c('do '),
			...handle(node.body, state),
			c(' while ('),
			...handle(node.test, state),
			c(');')
		];
	},

	ForStatement: scoped((node: ForStatement, state) => {
		const chunks = [c('for (')];

		if (node.init) {
			if ((node.init as VariableDeclaration).type === 'VariableDeclaration') {
				chunks.push(...handle_var_declaration(node.init as VariableDeclaration, state));
			} else {
				chunks.push(...handle(node.init, state));
			}
		}

		chunks.push(c('; '));
		if (node.test) chunks.push(...handle(node.test, state));
		chunks.push(c('; '));
		if (node.update) chunks.push(...handle(node.update, state));

		chunks.push(
			c(') '),
			...handle(node.body, state)
		);

		return chunks;
	}),

	ForInStatement: scoped((node: ForInStatement | ForOfStatement, state) => {
		const chunks = [
			c(`for ${(node as any).await ? 'await ' : ''}(`)
		];

		if ((node.left as VariableDeclaration).type === 'VariableDeclaration') {
			chunks.push(...handle_var_declaration(node.left as VariableDeclaration, state));
		} else {
			chunks.push(...handle(node.left, state));
		}

		chunks.push(
			c(node.type === 'ForInStatement' ? ` in ` : ` of `),
			...handle(node.right, state),
			c(') '),
			...handle(node.body, state)
		);

		return chunks;
	}),

	DebuggerStatement(node, state) {
		return [c('debugger', node), c(';')];
	},

	FunctionDeclaration: scoped((node: FunctionDeclaration, state) => {
		const chunks = [];

		if (node.async) chunks.push(c('async '));
		chunks.push(c(node.generator ? 'function* ' : 'function '));
		if (node.id) chunks.push(...handle(node.id, state));
		chunks.push(c('('));

		const params = node.params.map(p => handle(p, {
			...state,
			indent: state.indent + '\t'
		}));

		const multiple_lines = (
			params.some(has_newline) ||
			(params.map(get_length).reduce(sum, 0) + (state.indent.length + params.length - 1) * 2) > 80
		);

		const separator = c(multiple_lines ? `,\n${state.indent}` : ', ');

		if (multiple_lines) {
			chunks.push(
				c(`\n${state.indent}\t`),
				...join(params, separator),
				c(`\n${state.indent}`)
			);
		} else {
			chunks.push(
				...join(params, separator)
			);
		}

		chunks.push(
			c(') '),
			...handle(node.body, state)
		);

		return chunks;
	}),

	VariableDeclaration(node: VariableDeclaration, state) {
		return handle_var_declaration(node, state).concat(c(';'));
	},

	VariableDeclarator(node: VariableDeclarator, state) {
		if (node.init) {
			return [
				...handle(node.id, state),
				c(' = '),
				...handle(node.init, state)
			];
		} else {
			return handle(node.id, state);
		}
	},

	ClassDeclaration(node: ClassDeclaration, state) {
		const chunks = [c('class ')];

		if (node.id) chunks.push(...handle(node.id, state), c(' '));

		if (node.superClass) {
			chunks.push(
				c('extends '),
				...handle(node.superClass, state),
				c(' ')
			);
		}

		chunks.push(...handle(node.body, state));

		return chunks;
	},

	ImportDeclaration(node: ImportDeclaration, state) {
		const chunks = [c('import ')];

		const { length } = node.specifiers;
		const source = handle(node.source, state);

		if (length > 0) {
			let i = 0;

			while (i < length) {
				if (i > 0) {
					chunks.push(c(', '));
				}

				const specifier = node.specifiers[i];

				if (specifier.type === 'ImportDefaultSpecifier') {
					chunks.push(c(specifier.local.name, specifier));
					i += 1;
				} else if (specifier.type === 'ImportNamespaceSpecifier') {
					chunks.push(c('* as ' + specifier.local.name, specifier));
					i += 1;
				} else {
					break;
				}
			}

			if (i < length) {
				// we have named specifiers
				const specifiers = node.specifiers.slice(i).map((specifier: ImportSpecifier) => {
					const name = handle(specifier.imported, state)[0];
					const as = handle(specifier.local, state)[0];

					if (name.content === as.content) {
						return [as];
					}

					return [name, c(' as '), as];
				});

				const width = get_length(chunks) + specifiers.map(get_length).reduce(sum, 0) + (2 * specifiers.length) + 6 + get_length(source);

				if (width > 80) {
					chunks.push(
						c(`{\n\t`),
						...join(specifiers, c(',\n\t')),
						c('\n}')
					);
				} else {
					chunks.push(
						c(`{ `),
						...join(specifiers, c(', ')),
						c(' }')
					);
				}
			}

			chunks.push(c(' from '));
		}

		chunks.push(
			...source,
			c(';')
		);

		return chunks;
	},

	ImportExpression(node: any, state) {
		return [c('import('), ...handle(node.source, state), c(')')];
	},

	ExportDefaultDeclaration(node: ExportDefaultDeclaration, state) {
		const chunks = [
			c(`export default `),
			...handle(node.declaration, state)
		];

		if (node.declaration.type !== 'FunctionDeclaration') {
			chunks.push(c(';'));
		}

		return chunks;
	},

	ExportNamedDeclaration(node: ExportNamedDeclaration, state) {
		const chunks = [c('export ')];

		if (node.declaration) {
			chunks.push(...handle(node.declaration, state));
		} else {
			const specifiers = node.specifiers.map(specifier => {
				const name = handle(specifier.local, state)[0];
				const as = handle(specifier.exported, state)[0];

				if (name.content === as.content) {
					return [name];
				}

				return [name, c(' as '), as];
			});

			const width = 7 + specifiers.map(get_length).reduce(sum, 0) + 2 * specifiers.length;

			if (width > 80) {
				chunks.push(
					c('{\n\t'),
					...join(specifiers, c(',\n\t')),
					c('\n}')
				);
			} else {
				chunks.push(
					c('{ '),
					...join(specifiers, c(', ')),
					c(' }')
				);
			}

			if (node.source) {
				chunks.push(
					c(' from '),
					...handle(node.source, state)
				);
			}
		}

		chunks.push(c(';'));

		return chunks;
	},

	ExportAllDeclaration(node: ExportAllDeclaration, state) {
		return [
			c(`export * from `),
			...handle(node.source, state),
			c(`;`)
		];
	},

	MethodDefinition(node: MethodDefinition, state) {
		const chunks = [];

		if (node.static) {
			chunks.push(c('static '));
		}

		if (node.kind === 'get' || node.kind === 'set') {
			// Getter or setter
			chunks.push(c(node.kind + ' '));
		}

		if (node.value.async) {
			chunks.push(c('async '));
		}

		if (node.value.generator) {
			chunks.push(c('*'));
		}

		if (node.computed) {
			chunks.push(
				c('['),
				...handle(node.key, state),
				c(']')
			);
		} else {
			chunks.push(...handle(node.key, state));
		}

		chunks.push(c('('));

		const { params } = node.value;
		for (let i = 0; i < params.length; i += 1) {
			chunks.push(...handle(params[i], state));
			if (i < params.length - 1) chunks.push(c(', '));
		}

		chunks.push(
			c(') '),
			...handle(node.value.body, state)
		);

		return chunks;
	},

	ArrowFunctionExpression: scoped((node: ArrowFunctionExpression, state) => {
		const chunks = [];

		if (node.async) chunks.push(c('async '));

		if (node.params.length === 1 && node.params[0].type === 'Identifier') {
			chunks.push(...handle(node.params[0], state));
		} else {
			const params = node.params.map(param => handle(param, {
				...state,
				indent: state.indent + '\t'
			}));

			chunks.push(
				c('('),
				...join(params, c(', ')),
				c(')')
			);
		}

		chunks.push(c(' => '));

		if (node.body.type === 'ObjectExpression') {
			chunks.push(
				c('('),
				...handle(node.body, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.body, state));
		}

		return chunks;
	}),

	ThisExpression(node, state) {
		return [c('this', node)];
	},

	Super(node, state) {
		return [c('super', node)];
	},

	RestElement(node: RestElement, state) {
		return [c('...'), ...handle(node.argument, state)];
	},

	YieldExpression(node: YieldExpression, state) {
		if (node.argument) {
			return [c(node.delegate ? `yield* ` : `yield `), ...handle(node.argument, state)];
		}

		return [c(node.delegate ? `yield*` : `yield`)];
	},

	AwaitExpression(node: AwaitExpression, state) {
		if (node.argument) {
			return [c('await '), ...handle(node.argument, state)];
		}

		return [c('await')];
	},

	TemplateLiteral(node: TemplateLiteral, state) {
		const chunks = [c('`')];

		const { quasis, expressions } = node;

		for (let i = 0; i < expressions.length; i++) {
			chunks.push(
				c(quasis[i].value.raw),
				c('${'),
				...handle(expressions[i], state),
				c('}')
			);
		}

		chunks.push(
			c(quasis[quasis.length - 1].value.raw),
			c('`')
		);

		return chunks;
	},

	TaggedTemplateExpression(node: TaggedTemplateExpression, state) {
		return handle(node.tag, state).concat(handle(node.quasi, state));
	},

	ArrayExpression(node: ArrayExpression, state) {
		const chunks = [c('[')];

		const elements: Chunk[][] = [];
		let sparse_commas: Chunk[] = [];

		for (let i = 0; i < node.elements.length; i += 1) {
			// can't use map/forEach because of sparse arrays
			const element = node.elements[i];
			if (element) {
				elements.push([...sparse_commas, ...handle(element, {
					...state,
					indent: state.indent + '\t'
				})]);
				sparse_commas = [];
			} else {
				sparse_commas.push(c(','));
			}
		}

		const multiple_lines = (
			elements.some(has_newline) ||
			(elements.map(get_length).reduce(sum, 0) + (state.indent.length + elements.length - 1) * 2) > 80
		);

		if (multiple_lines) {
			chunks.push(
				c(`\n${state.indent}\t`),
				...join(elements, c(`,\n${state.indent}\t`)),
				c(`\n${state.indent}`),
				...sparse_commas
			);
		} else {
			chunks.push(...join(elements, c(', ')), ...sparse_commas);
		}

		chunks.push(c(']'));

		return chunks;
	},

	ObjectExpression(node: ObjectExpression, state) {
		if (node.properties.length === 0) {
			return [c('{}')];
		}

		let has_inline_comment = false;

		const chunks: Chunk[] = [];
		const separator = c(', ');

		node.properties.forEach((p, i) => {
			chunks.push(...handle(p, {
				...state,
				indent: state.indent + '\t'
			}));

			if (state.comments.length) {
				// TODO generalise this, so it works with ArrayExpressions and other things.
				// At present, stuff will just get appended to the closest statement/declaration
				chunks.push(c(', '));

				while (state.comments.length) {
					const comment = state.comments.shift();

					chunks.push(c(comment.type === 'Block'
						? `/*${comment.value}*/\n${state.indent}\t`
						: `//${comment.value}\n${state.indent}\t`));

					if (comment.type === 'Line') {
						has_inline_comment = true;
					}
				}
			} else {
				if (i < node.properties.length - 1) {
					chunks.push(separator);
				}
			}
		});

		const multiple_lines = (
			has_inline_comment ||
			has_newline(chunks) ||
			get_length(chunks) > 40
		);

		if (multiple_lines) {
			separator.content = `,\n${state.indent}\t`;
		}

		return [
			c(multiple_lines ? `{\n${state.indent}\t` : `{ `),
			...chunks,
			c(multiple_lines ? `\n${state.indent}}` : ` }`)
		];
	},

	Property(node: Property, state) {
		const value = handle(node.value, state);

		if (node.key === node.value) {
			return value;
		}

		// special case
		if (
			!node.computed &&
			node.value.type === 'AssignmentPattern' &&
			node.value.left.type === 'Identifier' &&
			node.value.left.name === (node.key as Identifier).name
		) {
			return value;
		}

		if (node.value.type === 'Identifier' && (
			(node.key.type === 'Identifier' && node.key.name === value[0].content) ||
			(node.key.type === 'Literal' && node.key.value === value[0].content)
		)) {
			return value;
		}

		const key = handle(node.key, state);

		if (node.method || (node.value.type === 'FunctionExpression' && !node.value.id)) {
			state = {
				...state,
				scope: state.scope_map.get(node.value)
			};

			const chunks = node.kind !== 'init'
				? [c(`${node.kind} `)]
				: [];

			chunks.push(
				...(node.computed ? [c('['), ...key, c(']')] : key),
				c('('),
				...join((node.value as FunctionExpression).params.map(param => handle(param, state)), c(', ')),
				c(') '),
				...handle((node.value as FunctionExpression).body, state)
			);

			return chunks;
		}

		if (node.computed) {
			return [
				c('['),
				...key,
				c(']: '),
				...value
			];
		}

		return [
			...key,
			c(': '),
			...value
		];
	},

	ObjectPattern(node: ObjectPattern, state) {
		const chunks = [c('{ ')];

		for (let i = 0; i < node.properties.length; i += 1) {
			chunks.push(...handle(node.properties[i], state));
			if (i < node.properties.length - 1) chunks.push(c(', '));
		}

		chunks.push(c(' }'));

		return chunks;
	},

	SequenceExpression(node: SequenceExpression, state) {
		const expressions = node.expressions.map(e => handle(e, state));

		return [
			c('('),
			...join(expressions, c(', ')),
			c(')')
		];
	},

	UnaryExpression(node: UnaryExpression, state) {
		const chunks = [c(node.operator)];

		if (node.operator.length > 1) {
			chunks.push(c(' '));
		}

		if (
			EXPRESSIONS_PRECEDENCE[node.argument.type] <
			EXPRESSIONS_PRECEDENCE.UnaryExpression
		) {
			chunks.push(
				c('('),
				...handle(node.argument, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.argument, state));
		}

		return chunks;
	},

	UpdateExpression(node: UpdateExpression, state) {
		return node.prefix
			? [c(node.operator), ...handle(node.argument, state)]
			: [...handle(node.argument, state), c(node.operator)];
	},

	AssignmentExpression(node: AssignmentExpression, state) {
		return [
			...handle(node.left, state),
			c(` ${node.operator || '='} `),
			...handle(node.right, state)
		];
	},

	BinaryExpression(node: BinaryExpression, state) {
		const chunks = [];

		// TODO
		// const is_in = node.operator === 'in';
		// if (is_in) {
		// 	// Avoids confusion in `for` loops initializers
		// 	chunks.push(c('('));
		// }

		if (needs_parens(node.left, node, false)) {
			chunks.push(
				c('('),
				...handle(node.left, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.left, state));
		}

		chunks.push(c(` ${node.operator} `));

		if (needs_parens(node.right, node, true)) {
			chunks.push(
				c('('),
				...handle(node.right, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.right, state));
		}

		return chunks;
	},

	ConditionalExpression(node: ConditionalExpression, state) {
		const chunks = [];

		if (
			EXPRESSIONS_PRECEDENCE[node.test.type] >
			EXPRESSIONS_PRECEDENCE.ConditionalExpression
		) {
			chunks.push(...handle(node.test, state));
		} else {
			chunks.push(
				c('('),
				...handle(node.test, state),
				c(')')
			);
		}

		const child_state = { ...state, indent: state.indent + '\t' };

		const consequent = handle(node.consequent, child_state);
		const alternate = handle(node.alternate, child_state);

		const multiple_lines = (
			has_newline(consequent) || has_newline(alternate) ||
			get_length(chunks) + get_length(consequent) + get_length(alternate) > 50
		);

		if (multiple_lines) {
			chunks.push(
				c(`\n${state.indent}? `),
				...consequent,
				c(`\n${state.indent}: `),
				...alternate
			);
		} else {
			chunks.push(
				c(` ? `),
				...consequent,
				c(` : `),
				...alternate
			);
		}

		return chunks;
	},

	NewExpression(node: NewExpression, state) {
		const chunks = [c('new ')];

		if (
			EXPRESSIONS_PRECEDENCE[node.callee.type] <
			EXPRESSIONS_PRECEDENCE.CallExpression || has_call_expression(node.callee)
		) {
			chunks.push(
				c('('),
				...handle(node.callee, state),
				c(')')
			)
		} else {
			chunks.push(...handle(node.callee, state));
		}

		// TODO this is copied from CallExpression — DRY it out
		const args = node.arguments.map(arg => handle(arg, {
			...state,
			indent: state.indent + '\t'
		}));

		const separator = args.some(has_newline) // TODO or length exceeds 80
			? c(',\n' + state.indent)
			: c(', ');

		chunks.push(
			c('('),
			...join(args, separator) as Chunk[],
			c(')')
		);

		return chunks;
	},

	CallExpression(node: CallExpression, state) {
		const chunks = [];

		if (
			EXPRESSIONS_PRECEDENCE[node.callee.type] <
			EXPRESSIONS_PRECEDENCE.CallExpression
		) {
			chunks.push(
				c('('),
				...handle(node.callee, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.callee, state));
		}

		const args = node.arguments.map(arg => handle(arg, state));

		const multiple_lines = args.slice(0, -1).some(has_newline); // TODO or length exceeds 80

		if (multiple_lines) {
			// need to handle args again. TODO find alternative approach?
			const args = node.arguments.map(arg => handle(arg, {
				...state,
				indent: `${state.indent}\t`
			}));

			chunks.push(
				c(`(\n${state.indent}\t`),
				...join(args, c(`,\n${state.indent}\t`)),
				c(`\n${state.indent})`)
			);
		} else {
			chunks.push(
				c('('),
				...join(args, c(', ')),
				c(')')
			);
		}

		return chunks;
	},

	MemberExpression(node: MemberExpression, state) {
		const chunks = [];

		if (EXPRESSIONS_PRECEDENCE[node.object.type] < EXPRESSIONS_PRECEDENCE.MemberExpression) {
			chunks.push(
				c('('),
				...handle(node.object, state),
				c(')')
			);
		} else {
			chunks.push(...handle(node.object, state));
		}

		if (node.computed) {
			chunks.push(
				c('['),
				...handle(node.property, state),
				c(']')
			);
		} else {
			chunks.push(
				c('.'),
				...handle(node.property, state)
			);
		}

		return chunks;
	},

	MetaProperty(node: MetaProperty, state) {
		return [...handle(node.meta, state), c('.'), ...handle(node.property, state)];
	},

	Identifier(node: Identifier, state) {
		let name = node.name;

		if (name[0] === '@') {
			name = state.getName(name.slice(1));
		} else if (node.name[0] === '#') {
			const owner = state.scope.find_owner(node.name);

			if (!owner) {
				throw new Error(`Could not find owner for node`);
			}

			if (!state.deconflicted.has(owner)) {
				state.deconflicted.set(owner, new Map());
			}

			const deconflict_map = state.deconflicted.get(owner);

			if (!deconflict_map.has(node.name)) {
				deconflict_map.set(node.name, deconflict(node.name.slice(1), owner.references));
			}

			name = deconflict_map.get(node.name);
		}

		return [c(name, node)];
	},

	Literal(node: Literal | RegExpLiteral, state) {
		if (typeof node.value === 'string') {
			return [
				// TODO do we need to handle weird unicode characters somehow?
				// str.replace(/\\u(\d{4})/g, (m, n) => String.fromCharCode(+n))
				c(JSON.stringify(node.value).replace(re, (_m, _i, at, hash, name) => {
					if (at)	return '@' + name;
					if (hash) return '#' + name;
					throw new Error(`this shouldn't happen`);
				}), node)
			];
		}

		const { regex } = node as RegExpLiteral; // TODO is this right?
		if (regex) {
			return [c(`/${regex.pattern}/${regex.flags}`, node)];
		}

		return [c(String(node.value), node)];
	}
};

handlers.ForOfStatement = handlers.ForInStatement;
handlers.FunctionExpression = handlers.FunctionDeclaration;
handlers.ClassExpression = handlers.ClassDeclaration;
handlers.ClassBody = handlers.BlockStatement;
handlers.SpreadElement = handlers.RestElement;
handlers.ArrayPattern = handlers.ArrayExpression;
handlers.LogicalExpression = handlers.BinaryExpression;
handlers.AssignmentPattern = handlers.AssignmentExpression;