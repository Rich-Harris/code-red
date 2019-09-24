// heavily based on https://github.com/davidbonnet/astring
// released under MIT license https://github.com/davidbonnet/astring/blob/master/LICENSE

import {
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
	ImportSpecifier
} from 'estree';

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
};

export function handle(node: Node, state: State): Chunk[] {
	const handler: Handler = handlers[node.type];

	if (!handler) {
		throw new Error(`Not implemented ${node.type}`);
	}

	return handler(node, state);
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
	ObjectExpression: NEEDS_PARENTHESES,
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
		const { scope } = state;
		state.scope = state.scope_map.get(node);
		const chunks = fn(node, state);
		state.scope = scope;
		return chunks;
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

const handlers: Record<string, Handler> = {
	Program(node: Program, state) {
		const chunks = [];

		for (let i = 0; i < node.body.length; i += 1) {
			const statement = handle(node.body[i], state);
			chunks.push(...statement);
		}

		return chunks;
	},

	BlockStatement: scoped((node: BlockStatement, state: State) => {
		const chunks = [c(`{\n${state.indent}\t`)];

		const body = node.body.map(statement => handle(statement, {
			...state,
			indent: state.indent + '\t'
		}));

		let needed_padding = false;

		for (let i = 0; i < body.length; i += 1) {
			const needs_padding = has_newline(body[i]);

			if (i > 0) {
				chunks.push(
					c(needs_padding || needed_padding ? `\n\n${state.indent}\t` : `\n${state.indent}\t`)
				);
			}

			chunks.push(
				...body[i]
			);

			needed_padding = needs_padding;
		}

		chunks.push(c(`\n${state.indent}}`));

		return chunks;
	}),

	EmptyStatement(node, state) {
		return [];
	},

	ExpressionStatement(node: ExpressionStatement, state) {
		const precedence = EXPRESSIONS_PRECEDENCE[node.expression.type]
		if (
			precedence === NEEDS_PARENTHESES ||
			(precedence === 3 && node.expression.left.type[0] === 'O')
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
		throw new Error(`TODO IfStatement`);
	},

	LabeledStatement(node: LabeledStatement, state) {
		throw new Error(`TODO LabeledStatement`);
	},

	BreakStatement(node: BreakStatement, state) {
		throw new Error(`TODO BreakStatement`);
	},

	ContinueStatement(node: ContinueStatement, state) {
		throw new Error(`TODO ContinueStatement`);
	},

	WithStatement(node: WithStatement, state) {
		throw new Error(`TODO WithStatement`);
	},

	SwitchStatement(node: SwitchStatement, state) {
		throw new Error(`TODO SwitchStatement`);
	},

	ReturnStatement(node: ReturnStatement, state) {
		return [
			c('return '),
			...handle(node.argument, state),
			c(';')
		];
	},

	ThrowStatement(node: ThrowStatement, state) {
		throw new Error(`TODO ThrowStatement`);
	},

	TryStatement(node: TryStatement, state) {
		throw new Error(`TODO TryStatement`);
	},

	WhileStatement(node: WhileStatement, state) {
		throw new Error(`TODO WhileStatement`);
	},

	DoWhileStatement(node: DoWhileStatement, state) {
		throw new Error(`TODO DoWhileStatement`);
	},

	ForStatement: scoped((node: ForStatement, state) => {
		const chunks = [c('for (')];

		if (node.init) chunks.push(...handle(node.init, state));
		chunks.push(
			c(node.init && (node.init as VariableDeclaration).type === 'VariableDeclaration' ? ' ' : '; ')
		);
		if (node.test) chunks.push(...handle(node.test, state));
		chunks.push(c('; '));
		if (node.update) chunks.push(...handle(node.update, state));

		chunks.push(
			c(') '),
			...handle(node.body, state)
		);

		return chunks;
	}),

	ForInStatement: scoped((node: ForInStatement, state) => {
		throw new Error(`TODO ForInStatement`);
	}),

	DebuggerStatement(node, state) {
		return [c('debugger', node), c(';')];
	},

	FunctionDeclaration: scoped((node: FunctionDeclaration, state) => {
		const chunks = [];

		if (node.async) chunks.push(c('async '));
		chunks.push(c(node.generator ? 'function* ' : 'function '));
		if (node.id) chunks.push(c(node.id.name, node.id));
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
		const chunks = [c(`${node.kind} `)];

		const declarators = node.declarations.map(d => handle(d, {
			...state,
			indent: state.indent + '\t'
		}));

		const multiple_lines = (
			declarators.some(has_newline) ||
			(declarators.map(get_length).reduce(sum, 0) + (state.indent.length + declarators.length - 1) * 2) > 80
		);

		const separator = c(multiple_lines ? `,\n${state.indent}` : ', ');

		if (multiple_lines) {
			chunks.push(
				c(`\n${state.indent}\t`),
				...join(declarators, separator),
				c(`\n${state.indent}`)
			);
		} else {
			chunks.push(
				...join(declarators, separator)
			);
		}

		chunks.push(
			c(';')
		);

		return chunks;
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
		throw new Error(`TODO ClassDeclaration`);
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
				const specifiers = node.specifiers.map((specifier: ImportSpecifier) => {
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

	ExportDefaultDeclaration(node: ExportDefaultDeclaration, state) {
		throw new Error(`TODO ExportDefaultDeclaration`);
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
		throw new Error(`TODO ExportAllDeclaration`);
	},

	MethodDefinition(node: MethodDefinition, state) {
		throw new Error(`TODO MethodDefinition`);
	},

	ArrowFunctionExpression: scoped((node: ArrowFunctionExpression, state) => {
		const chunks = [];

		if (node.async) chunks.push(c('async '));

		if (node.params.length === 1 && node.params[0].type === 'Identifier') {
			chunks.push(...handle(node.params[0], state));
		} else {
			throw new Error('TODO multiple params');
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
		throw new Error(`TODO RestElement`);
	},

	YieldExpression(node: YieldExpression, state) {
		throw new Error(`TODO YieldExpression`);
	},

	AwaitExpression(node: AwaitExpression, state) {
		throw new Error(`TODO AwaitExpression`);
	},

	TemplateLiteral(node: TemplateLiteral, state) {
		throw new Error(`TODO TemplateLiteral`);
	},

	TaggedTemplateExpression(node: TaggedTemplateExpression, state) {
		throw new Error(`TODO TaggedTemplateExpression`);
	},

	ArrayExpression(node: ArrayExpression, state) {
		throw new Error(`TODO ArrayExpression`);
	},

	ObjectExpression(node: ObjectExpression, state) {
		const properties = node.properties.map(p => handle(p, {
			...state,
			indent: state.indent + '\t'
		}));

		const multiple_lines = (
			properties.some(has_newline) ||
			(properties.map(get_length).reduce(sum, 0) + (state.indent.length + properties.length - 1) * 2) > 80
		);

		const separator = c(multiple_lines ? ',\n' + state.indent : ', ');

		return [
			c(multiple_lines ? `{\n${state.indent}` : `{ `),
			...join(properties, separator) as Chunk[],
			c(multiple_lines ? `\n${state.indent}}` : ` }`)
		];
	},

	Property(node: Property, state) {
		const key = handle(node.key, state);
		const value = handle(node.value, state);

		if (key.length === 1 && value.length === 1 && key[0].content === value[0].content) {
			return value;
		}


		if (node.method || node.kind !== 'init') {
			throw new Error('TODO');
		}

		return [
			...key,
			c(': '),
			...value
		];
	},

	ObjectPattern(node: ObjectPattern, state) {
		throw new Error(`TODO ObjectPattern`);
	},

	SequenceExpression(node: SequenceExpression, state) {
		throw new Error(`TODO SequenceExpression`);
	},

	UnaryExpression(node: UnaryExpression, state) {
		throw new Error(`TODO UnaryExpression`);
	},

	UpdateExpression(node: UpdateExpression, state) {
		throw new Error(`TODO UpdateExpression`);
	},

	AssignmentExpression(node: AssignmentExpression, state) {
		return [
			...handle(node.left, state),
			c(` ${node.operator} `),
			...handle(node.right, state)
		];
	},

	AssignmentPattern(node: AssignmentPattern, state) {
		throw new Error(`TODO AssignmentPattern`);
	},

	BinaryExpression(node: BinaryExpression, state) {
		const chunks = [];

		const is_in = node.operator === 'in'
		if (is_in) {
			// Avoids confusion in `for` loops initializers
			chunks.push(c('('));
		}

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
		throw new Error(`TODO ConditionalExpression`);
	},

	NewExpression(node: NewExpression, state) {
		throw new Error(`TODO NewExpression`);
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
		throw new Error(`TODO MetaProperty`);
	},

	Identifier(node: Identifier, state) {
		let name = node.name;

		if (name[0] === '@') {
			name = state.getName(name.slice(1));
		} else if (node.name[0] === '#') {
			const owner = state.scope.find_owner(node.name);

			if (!owner) {
				console.log(node);
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
		// TODO
		if (typeof node.value === 'string') {
			return [c(JSON.stringify(node.value), node)];
		}

		const { regex } = node as RegExpLiteral; // TODO is this right?
		if (regex) {
			return [c(`/${regex.pattern}/${regex.flags}`, node)];
		}

		return [c(String(node.value), node)];
	},

	RegExpLiteral(node: RegExpLiteral, state) {
		throw new Error(`TODO RegExpLiteral`);
	},
};

handlers.ForOfStatement = handlers.ForInStatement;
handlers.FunctionExpression = handlers.FunctionDeclaration;
handlers.ClassExpression = handlers.ClassDeclaration;
handlers.ClassBody = handlers.BlockStatement;
handlers.SpreadElement = handlers.RestElement;
handlers.ArrayPattern = handlers.ArrayExpression;
handlers.LogicalExpression = handlers.BinaryExpression;